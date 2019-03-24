# Keep it simple!
# 
# "There are two ways of constructing a software design: One way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies." - C.A.R. Hoare

  # TODO:
  # don't create more than one ballot div to interpret (e.g. if you go back and revise an old one)
  # translate from ballot # to batch location
  # feed seed thing in -- get real ballot numbers


import copy
import csv
from datetime import datetime # , isoformat
from flask import Flask, jsonify, request, url_for, send_from_directory, Response
from werkzeug import secure_filename
import os
# https://docs.python.org/3/library/typing.html
from typing import List, Dict

# os.sys.path.append('../RIWAVE/WAVE')
# os.sys.path.append('RIWAVE/WAVE/audit')
os.sys.path.append('RIWAVE/WAVE')
os.sys.path.append("2018-bctool/code/")

import audit as WAVEaudit
import election as WAVEelection
# import BallotPolling
# self._tolerance

# os.sys.path.append('audit_cvrs/audit_cvrs')
# import rlacalc

# In the future, replace this with consistent_sampler?:
os.sys.path.append('rivest-sampler-tests/src/sampler')
import sampler

# os.sys.path.append("2018-bctool/code/")
# import bctool

audit_log_dir = 'audit_logs'
if not os.path.exists(audit_log_dir):
   os.makedirs(audit_log_dir)
UPLOAD_FOLDER = 'scratch_files' # better name?
if not os.path.exists(UPLOAD_FOLDER):
   os.makedirs(UPLOAD_FOLDER)


app = Flask(__name__, static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

Interpretation = Dict[str, List[Dict[str, str]]]

# Do we need this, or do we just need the seed?:
#   (Is it repetitive to track this?)

def add_non_candidate_choices(l):
    return list(set(l).union({"overvote", "undervote", "Write-in"}))

# CONFIGURATION STATE

# Usually you'd run the audit until a stopping condition, but for the pilot
#   we're fixing the fixing the number of ballots to interpret:
number_of_ballots_to_interpret = {
   'ballot_polling': 200,
   'ballot_comparison': 100,
   }



## Portsmouth ballot polling audit

all_contests_portsmouth = [
      {'id': 'governor',
       'title': 'Governor',
       'candidates': ['DEM Gina M. Raimondo', 'MOD William H. Gilbert', 'REP Allan W. Fung', 'Com Anne Armstrong', 'Ind Luis Daniel Munoz', 'Ind Joseph A. Trillo'],
      },
      ]

   # total_main_ballots_cast = 7963  ## this could come from manifest
   
   # overvotes and undervotes are unknown, although they appear to total 67
reported_results_portsmouth = [
       {'contest_id': 'governor',
        'results': [
          {'candidate': 'DEM Gina M. Raimondo',
           'proportion': 0.5607,
           'votes': 4427 # TODO: these don't add up to total count -- matters?
          },
          {'candidate': 'MOD William H. Gilbert',
           'proportion': 0.0265,
           'votes': 209
          },
          {'candidate': 'REP Allan W. Fung',
           'proportion': 0.3387,
           'votes': 2674
          },
          {'candidate': 'Com Anne Armstrong',
           'proportion': 0.0111,
           'votes': 88
          },
          {'candidate': 'Ind Luis Daniel Munoz',
           'proportion': 0.0129,
           'votes': 102
          },
          {'candidate': 'Ind Joseph A. Trillo',
           'proportion': 0.0477,
           'votes': 377
          },
          {'candidate': 'Write-in',
           'proportion': 0.0024,
           'votes': 19
          }
          ]
       }
   ]
   
# Bristol ballot-level comparison audit: all federal/statewide
# contests and candidates are in the order of appearance on the ballot
# (or data entry screen)

all_contests_bristol = [

      {'id': 'senator',
       'title': 'Senator in Congress',
       'candidates': ['DEM Sheldon Whitehouse', 'REP Robert G. Flanders Jr.'],
      },
      {'id': 'rep_1',
       'title': 'Representative in Congress District 1 (13213)',
       'candidates': ['DEM David N. Cicilline (13215)', 'REP Patrick J. Donovan'],
      },
      {'id': 'governor',
       'title': 'Governor',
       'candidates': ['DEM Gina M. Raimondo', 'MOD William H. Gilbert', 'REP Allan W. Fung', 'Com Anne Armstrong', 'Ind Luis Daniel Munoz', 'Ind Joseph A. Trillo'],
      },
      {'id': 'lieutenant_governor',
       'title': 'Lieutenant Governor',
       'candidates': ['DEM Daniel J. McKee', 'MOD Joel J. Hellmann', 'REP Paul E. Pence', 
             'Ind Jonathan J. Riccitelli', 'Ind Ross K. McCurdy'],
      },
      {'id': 'secretary_of_state',
       'title': 'Secretary of State',
       'candidates': ['DEM Nellie M. Gorbea', 'REP Pat V. Cortellessa'],
      },
      {'id': 'attorney_general',
       'title': 'Attorney General',
       'candidates': ['DEM Peter F. Neronha', 'Com Alan Gordon'],
      },
      {'id': 'treasurer',
       'title': 'General Treasurer',
       'candidates': ['DEM Seth Magaziner', 'REP Michael G. Riley'],
      },
      {'id': 'issue_1',
       'title': '1. RHODE ISLAND SCHOOL BUILDINGS - $250,000,000',
       'candidates': ['Approve', 'Reject'],
      },
      {'id': 'issue_2',
       'title': '2. HIGHER EDUCATION FACILITIES - $70,000,000',
       'candidates': ['Approve', 'Reject'],
      },
      {'id': 'issue_3',
       'title': '3. GREEN ECONOMY AND CLEAN WATER - $47,300,000',
       'candidates': ['Approve', 'Reject'],
      },
      ]

   # 'main_contest_id': 'issue_2', 

   #ballots_cast_for_main_apparent_winner = 
   # total_main_ballots_cast = 9021
reported_results_bristol = [
      {'contest_id': 'senator',
        'results': [
          {'candidate': 'DEM Sheldon Whitehouse',
           'proportion': 0.595, # shouldn't be needed at all
           'votes': 5367
          },
          {'candidate': 'REP Robert G. Flanders Jr.',
           'proportion': 0.389,
           'votes': 3506
          },
          {'candidate': 'Write-in',
           'proportion': 0.002,
           'votes': 19
          },
          {'candidate': 'undervote',
           'proportion': 0.014,
           'votes': 127
          },
          {'candidate': 'overvote',
           'proportion': 0.0002,
           'votes': 2
          }
          ]},

      {'contest_id': 'rep_1',
        'results': [
          {'candidate': 'DEM David N. Cicilline (13215)',
           'proportion': 0.601, 
           'votes': 5424
          },
          {'candidate': 'REP Patrick J. Donovan',
           'proportion': 0.379,
           'votes': 3417
          },
          {'candidate': 'Write-in',
           'proportion': 0.001,
           'votes': 13
          },
          {'candidate': 'undervote',
           'proportion': 0.018,
           'votes': 166
          },
          {'candidate': 'overvote',
           'proportion': 0.0001,
           'votes': 1
          }
          ]},

       
      {'contest_id': 'governor',
        'results': [
          {'candidate': 'DEM Gina M. Raimondo',
           'proportion': 0.526,
           'votes': 4749
          },
          {'candidate': 'MOD William H. Gilbert',
           'proportion': 0.028,
           'votes': 256
          },
          {'candidate': 'REP Allan W. Fung',
           'proportion': 0.343,
           'votes': 3094
          },
          {'candidate': 'Com Anne Armstrong',
           'proportion': 0.011,
           'votes': 103
          },
          {'candidate': 'Ind Luis Daniel Munoz',
           'proportion': 0.014,
           'votes': 123
          },
          {'candidate': 'Ind Joseph A. Trillo',
           'proportion': 0.056,
           'votes': 509
          },
          {'candidate': 'Write-in',
           'proportion': 0.004,
           'votes': 32
          },
          {'candidate': 'undervote',
           'proportion': 0.016,
           'votes': 143
          },
          {'candidate': 'overvote',
           'proportion': 0.001,
           'votes': 12
          }          
          ]},

      {'contest_id': 'lieutenant_governor',
        'results': [
          {'candidate': 'DEM Daniel J. McKee',
           'proportion': 0.575,
           'votes': 5184
          },
          {'candidate': 'MOD Joel J. Hellmann',
           'proportion': 0.032,
           'votes': 291
          },
          {'candidate': 'REP Paul E. Pence',
           'proportion': 0.273,
           'votes': 2464
          },
          {'candidate': 'Ind Jonathan J. Riccitelli',
           'proportion': 0.028,
           'votes': 251
          },
          {'candidate': 'Ind Ross K. McCurdy',
           'proportion': 0.022,
           'votes': 202
          },
          {'candidate': 'Write-in',
           'proportion': 0.015,
           'votes': 137
          },
          {'candidate': 'undervote',
           'proportion': 0.054,
           'votes': 490
          },
          {'candidate': 'overvote',
           'proportion': 0.0002,
           'votes': 2
          }          
          ]},

      {'contest_id': 'secretary_of_state',
        'results': [
          {'candidate': 'DEM Nellie M. Gorbea',
           'proportion': 0.651, 
           'votes': 5873
          },
          {'candidate': 'REP Pat V. Cortellessa',
           'proportion': 0.306,
           'votes': 2757
          },
          {'candidate': 'Write-in',
           'proportion': 0.001,
           'votes': 10
          },
          {'candidate': 'undervote',
           'proportion': 0.042,
           'votes': 381
          },
          {'candidate': 'overvote',
           'proportion': 0.0,
           'votes': 0
          }
          ]},
  
      {'contest_id': 'attorney_general',
        'results': [
          {'candidate': 'DEM Peter F. Neronha',
           'proportion': 0.727, 
           'votes': 6560
          },
          {'candidate': 'Com Alan Gordon',
           'proportion': 0.163,
           'votes': 1468
          },
          {'candidate': 'Write-in',
           'proportion': 0.006,
           'votes': 51
          },
          {'candidate': 'undervote',
           'proportion': 0.104,
           'votes': 941
          },
          {'candidate': 'overvote',
           'proportion': 0.0001,
           'votes': 1
          }
          ]},

      {'contest_id': 'treasurer',
        'results': [
          {'candidate': 'DEM Seth Magaziner',
           'proportion': 0.658, 
           'votes': 5932
          },
          {'candidate': 'REP Michael G. Riley',
           'proportion': 0.305,
           'votes': 2751
          },
          {'candidate': 'Write-in',
           'proportion': 0.008,
           'votes': 7
          },
          {'candidate': 'undervote',
           'proportion': 0.037,
           'votes': 330
          },
          {'candidate': 'overvote',
           'proportion': 0.0001,
           'votes': 1
          }
          ]},

      {'contest_id': 'issue_1',
        'results': [
          {'candidate': 'Approve',
           'proportion': 0.724, 
           'votes': 6534
          },
          {'candidate': 'Reject',
           'proportion': 0.225,
           'votes': 2027
          },
          {'candidate': 'undervote',
           'proportion': 0.051,
           'votes': 459
          },
          {'candidate': 'overvote',
           'proportion': 0.0001,
           'votes': 1
          }
          ]},

      {'contest_id': 'issue_2',
        'results': [
          {'candidate': 'Approve',
           'proportion': 0.530, 
           'votes': 4779
          },
          {'candidate': 'Reject',
           'proportion': 0.411,
           'votes': 3708
          },
          {'candidate': 'undervote',
           'proportion': 0.059,
           'votes': 533
          },
          {'candidate': 'overvote',
           'proportion': 0.0001,
           'votes': 1
          }
          ]},

      {'contest_id': 'issue_3',
        'results': [
          {'candidate': 'Approve',
           'proportion': 0.749, 
           'votes': 6753
          },
          {'candidate': 'Reject',
           'proportion': 0.197,
           'votes': 1779
          },
          {'candidate': 'undervote',
           'proportion': 0.054,
           'votes': 489
          }
          ]}
    ]



# Maybe a named tuple instead?:
default_audit_state = {
   # We don't send this whole thing over the wire every time, because it can be huge. Everything else we do:
   #   (Maybe it shouldn't be in audit_state, then?)

# 'cvr_files':
   'cvrs': {}, # None,

# 'cvr_hashes':
   'cvr_hash': {}, # None,
   'all_interpretations': {'ballot_polling': [], 'ballot_comparison': []},
   'seed': None,
   # 'main_contest_in_progress': None,
   'audit_name': None,
   'audit_type_name': None,
   'ballot_manifest': {}, # None,
   # these next two can be gotten from 'ballot_manifest':
   'total_number_of_ballots': {},
   # We don't actually use this:
   'num_ballots_already_sampled': 0,
   'ballot_ids': {'ballot_polling': [], 'ballot_comparison': []}, # None, # {'ballot_polling': [], 'ballot_comparison': []},

   # Hardcoding/configuration, which will come from various CSVs in the future:
   # ("Main" means the one contest we're non-opportunistically auditing):
   # TODO: write-in etc should go here (so we have them in the ballot polling)
   # 'all_contests': None, 
#       [
#
##      {'id': 'congress_district_1',
##       'title': 'Representative in Congress District 1 (13213)',
##       'candidates': ['DEM David N. Cicilline (13215)', 'REP Patrick J. Donovan'],
##      },
#      {'id': 'lieutenant_governor',
#       'title': 'Lieutenant Governor',
#       'candidates': ['DEM Daniel J. McKee', 'REP Paul E. Pence', 'MOD Joel J. Hellmann', 'Ind Jonathan J. Riccitelli'],
#      },
#      {'id': 'senator',
#       'title': 'Senator in Congress',
#       'candidates': ['DEM Sheldon Whitehouse', 'REP Robert G. Flanders, Jr.'],
#      },
#      {'id': 'governor',
#       'title': 'Governor',
#       'candidates': ['DEM Gina M. Raimondo', 'REP Allan W. Fung'],
#      },
#      ],
   # This'd be for if we're computing one risk limit and opportunistically auditing others. That doesn't apply to the RI pilot:
   # 'main_contest_id': 'lieutenant_governor', #congress_district_1',
   #ballots_cast_for_main_apparent_winner = 600
   # total_main_ballots_cast = 1000
   # doing per-contest_type instead:
   'reported_results': None,

   # A little kludgy - would like to rewrite in the future:
   'all_contests': {
      'ballot_polling': all_contests_portsmouth,
      'ballot_comparison': all_contests_bristol,
      },
   # in the future, may (or may not) want to store all ballot location info in 'audit_state':
   'imprinted_ids': {
      },

#       [
#       {'contest_id': 'lieutenant_governor',
#        'results': [
#          {'candidate': 'DEM Daniel J. McKee',
#           'proportion': 0.9,
#           'votes': 90, # TODO: these don't add up to total count -- matters?
#          },
#          {'candidate': 'REP Paul E. Pence',
#           'proportion': 0.04,
#           'votes': 4,
#          },
#          {'candidate': 'MOD Joel J. Hellmann',
#           'proportion': 0.04,
#           'votes': 4,
#          },
#          {'candidate': 'Ind Jonathan J. Riccitelli',
#           'proportion': 0.02,
#           'votes': 2
#          },
#          {'candidate': 'overvote',
#           'proportion': 0,
#           'votes': 0,
#          },
#          {'candidate': 'undervote',
#           'proportion': 0,
#           'votes': 0,
#          },
#          {'candidate': 'Write-in',
#           'proportion': 0,
#           'votes': 0,
#          },
#          ]
#       },
#
#       {'contest_id': 'senator',
#        'results': [
#           {'candidate': 'DEM Sheldon Whitehouse',
#            'proportion': 0.7,
#            'votes': 70,
#           },
#           {'candidate': 'REP Robert G. Flanders, Jr.',
#            'proportion': 0.3,
#            'votes': 30,
#           },
#           {'candidate': 'overvote',
#            'proportion': 0,
#            'votes': 0,
#           },
#           {'candidate': 'undervote',
#            'proportion': 0,
#            'votes': 0,
#           },
#           {'candidate': 'Write-in',
#            'proportion': 0,
#            'votes': 0,
#           },
#           ],
#       },
#       {'contest_id': 'governor',
#        'results': [
#           {'candidate': 'DEM Gina M. Raimondo',
#            'proportion': 0.55,
#            'votes': 55,
#           },
#           {'candidate': 'REP Allan W. Fung',
#            'proportion': 0.45,
#            'votes': 45,
#           },
#           {'candidate': 'overvote',
#            'proportion': 0,
#            'votes': 0,
#           },
#           {'candidate': 'undervote',
#            'proportion': 0,
#            'votes': 0,
#           },
#           {'candidate': 'Write-in',
#            'proportion': 0,
#            'votes': 0,
#           },
#           ]
#       },
#
#
#       ]

#      {'candidate': 'DEM David N. Cicilline (13215)',
#       'proportion': 0.9, # 0.6,
#       'votes': 90,
#      },
#      {'candidate': 'REP Patrick J. Donovan',
#       'proportion': 0.1, # 0.4,
#       'votes': 10,
#      },
#      ],
   }

audit_state = copy.deepcopy(default_audit_state)







def call_f(f, *args, **kwargs):
    # TODO: log instead of print:
    print(tuple((datetime.now().isoformat(), f.__name__, args, kwargs)))
    f(*args, **kwargs)

# example usage:
def test_0(a, b, c):
    print(a*b+c)
call_f(test_0, 4, 5, 6)
call_f(test_0, c=4, b=5, a=6)


def make_contestant(name):
    return WAVEelection.Contestant(ID=name, name=name)

# TODO: type:
def make_result(all_contestants, result_dict):
    # TODO: we construct these candidates here. Make sure there are
    #   no issues with pointer equality from creating them twice:
    contestant = all_contestants[result_dict['candidate']]
    return WAVEelection.Result(contestant=contestant, percentage=result_dict['proportion'], votes=result_dict['votes'])

def make_ballot(all_contestants, interpretation, contest_id):
    ballot = WAVEelection.Ballot()
    #ballot.set_audit_seq_num(i+1)
    #ballot.get_physical_ballot_num(i+1):
    # interp {'ballot_id': 9104, 'contests': {'congress_district_1': 'David N. Cicilline', 'assembly_19': 'David M. Chenevert', 'council_at_large': 'Peter J. Bradley'}}
    # ballot.set_reported_value(yes) # for ballot comparison
    ballot.set_actual_value(all_contestants[interpretation['contests'][contest_id]])
    return ballot

# TODO: type:
def get_ballot_polling_results():
    bp = WAVEaudit.BallotPolling()

    contest_outcomes = []
    # for results in audit_state['reported_results']:
    reported_results = audit_types['ballot_polling']['reported_results']
    for results in reported_results:
        contest_id = results['contest_id']
        # TODO: 'all_contests' should probably be a dict instead:
        contest        = list(filter(lambda c: c['id'] == contest_id, audit_types['ballot_polling']['all_contests']))[0]
        contest_result = list(filter(lambda c: c['contest_id'] == contest_id, reported_results))[0]
    
        # TODO: clean up how we do this. This is just a quick way to
        #   make sure we have all options since there may be ones not
        #   in the contest description (e.g. write-ins, or "no
        #   selection"):
        all_contestant_names = list(set(contest['candidates']).union({ i['contests'][contest_id] for i in audit_state['all_interpretations']['ballot_polling']}))
        all_contestant_names = add_non_candidate_choices(all_contestant_names)

        all_contestants = { name: make_contestant(name) for name in all_contestant_names }
        all_contestants['overvote'] = WAVEelection.Overvote()
        all_contestants['undervote'] = WAVEelection.Undervote()

        reported_results = [ make_result(all_contestants, r) for r in contest_result['results'] ]
        bp.init(results=reported_results, ballot_count=audit_state['total_number_of_ballots']['ballot_polling']) # 100)
        bp.set_parameters([1]) # this is a tolerance of 1%
        ballots = [ make_ballot(all_contestants, i, contest_id) for i in audit_state['all_interpretations']['ballot_polling'] ]
        final_ballot = len(ballots) >= number_of_ballots_to_interpret['ballot_polling']
        print("DEBUG: ballots: %d final ballot: %s" %(len(ballots),final_ballot))
        if (final_ballot):
            bp.recompute(results=reported_results, ballots=ballots)
        else:
            # Update reported results, but don't do stats calculations
            bp.update_reported_ballots(results=reported_results, ballots=ballots)
        status = 'Done' if final_ballot else bp.get_status()

        contest_outcomes.append({'status': status, 'progress': bp.get_progress(final=final_ballot), 'contest_id': contest['id'], 'upset_prob': bp.upset_prob})

    return(jsonify({'outcomes': contest_outcomes}))

def get_ballot_comparison_results():

    rla = WAVEaudit.Comparison()

    contest_outcomes = []
    reported_results_obj = audit_types['ballot_comparison']['reported_results']
    for results in reported_results_obj:
        contest_id = results['contest_id']
        # TODO: 'all_contests' should probably be a dict instead:
        contest        = list(filter(lambda c: c['id'] == contest_id, audit_types['ballot_comparison']['all_contests']))[0]
        contest_result = list(filter(lambda c: c['contest_id'] == contest_id, reported_results_obj))[0]

    # TODO: also replace these lines with getting directly from CVR (is that the usual way to do it?):
        all_contestant_names = list(set(contest['candidates']).union({ i['contests'][contest['id']] for i in audit_state['all_interpretations']['ballot_comparison'] if contest['id'] in i['contests']}))
        all_contestant_names = add_non_candidate_choices(all_contestant_names)

        all_contestants = { name: make_contestant(name) for name in all_contestant_names }
        all_contestants['overvote'] = WAVEelection.Overvote()
        all_contestants['undervote'] = WAVEelection.Undervote()

    
        reported_choices = {k: 0 for k in all_contestant_names}
        for d in contest_result['results']:
            reported_choices[d['candidate']] += d['votes']

        assert(sum(reported_choices.values()) == audit_state['total_number_of_ballots']['ballot_comparison'])

        ballot_count = sum(reported_choices.values())
        reported_results = [ make_result(all_contestants, r) for r in contest_result['results'] ]
    
        rla.init(reported_results, ballot_count, reported_choices)
    
        # These are, in order:
        #   - Risk Limit   (note it's: float(param[0]) / 100)
        #   - Error Inflation Factor
        #   - Expected 1-vote Overstatement Rate
        #   - Expected 2-vote Overstatement Rate
        #   - Expected 1-vote Understatement Rate
        #   - Expected 2-vote Understatement Rate
        # These values are taken from the RIWAVE tests:
        rla.set_parameters([5, 1.03905, 0.001, 0.0001, 0.001, 0.0001])
    
        ballots = []
        for interpretation in audit_state['all_interpretations']['ballot_comparison']:
            if contest['id'] in interpretation['contests']:
                ballot = WAVEelection.Ballot()
                # TODO:
                ballot.set_actual_value(all_contestants[interpretation['contests'][contest['id']]])
                ballot.set_audit_seq_num(interpretation['ballot_id'])
                # TODO: this is one way to do the ballot number but it might not be (probably isn't) the best:
                matching_cvr = audit_state['cvrs']['ballot_comparison'][interpretation['ballot_id']]
                ballot.set_reported_value(all_contestants[matching_cvr[contest['title']]])
                ballots.append(ballot)
        # TODO: second condition is a special case for the RI audit, where not every ballot has every contest (but they're all on the last one):
        final_ballot = (len(ballots) >= number_of_ballots_to_interpret['ballot_comparison']) or (audit_state['ballot_ids']['ballot_comparison'][-1] == audit_state['all_interpretations']['ballot_comparison'][-1]['ballot_id'])
        print("DEBUG: ballots: %d final ballot: %s" %(len(ballots),final_ballot))
        if (final_ballot):
            rla.recompute(ballots, reported_results)
        else:
            # Update reported results, but don't do stats calculations
            rla.update_reported_ballots(ballots=ballots, results=reported_results)
        status = 'Done' if final_ballot else rla.get_status()
        
        contest_outcomes.append({'status': status, 'progress': rla.get_progress(final=final_ballot), 'contest_id': contest['id'], 'upset_prob': rla.upset_prob})

    return(jsonify({'outcomes': contest_outcomes}))


audit_types = {
    'ballot_polling': {
        'get_results': get_ballot_polling_results,
        'init': None,
        'all_contests': all_contests_portsmouth,
        'reported_results': reported_results_portsmouth,
        },
    'ballot_comparison': {
        'get_results': get_ballot_comparison_results,
        'init': None,
        'all_contests': all_contests_bristol,
        'reported_results': reported_results_bristol,
        },
    'ri_pilot': {
        # Instead, we call out to other 'get_results'es:
        'get_results': None,
        'init': None,
        # Calling out again:
        'all_contests': None,
        'reported_results': None,
        },
    }


@app.route('/get-audit-types')
def get_audit_types():
    return jsonify({'types': list(audit_types.keys())})

@app.route('/set-audit-type', methods=['POST'])
def set_audit_type():
    data = request.get_json()
    if 'type' in data:
        if data['type'] in audit_types:
            global audit_state
            audit_state['audit_type_name'] = data['type']
            # audit_state['reported_results'] = audit_types[data['type']]['reported_results']
            # audit_state['all_contests'] = audit_types[data['type']]['all_contests']
            t = audit_types[data['type']]
            return ''
        else:
            return "That audit type isn't a choice", 422
    else:
        return 'Key "type" not present in request', 422

@app.route('/set-audit-name', methods=['POST'])
def set_audit_name():
    data = request.get_json()
    if 'audit_name' in data:
        global audit_state
        audit_state['audit_name'] = data['audit_name']
        return ''
    else:
        return 'Key "audit_name" not present in request', 422

# @app.route('/get-contests')
# def route_get_contests():
#     return jsonify({'contests': audit_state['all_contests']})

@app.route('/add-interpretation', methods=['POST'])
def add():
   data = request.get_json()
   app.logger.debug(data)
   if 'interpretation' in data:
      global audit_state
      audit_state['all_interpretations'][data['contest_type']].append(data['interpretation'])
      return ''
   else:
      return 'Key "interpretation" is not present in the request', 422

@app.route('/get-all-interpretations')
def get_all_interpretations():
   # global audit_state
   return str((audit_state['all_interpretations'])) # , bp._ballot_count, seed))

@app.route('/get-audit-state', methods=['GET', 'POST'])
def get_audit_state():
   without_cvrs = { k: v for k, v in audit_state.items() if k != 'cvrs' }
   if audit_state['audit_name']:
       fname = os.path.join(audit_log_dir, audit_state['audit_name']+'_states.txt')
       with open(fname, 'a') as states_file:
           states_file.write('\n'+str(tuple((datetime.now().isoformat(), without_cvrs))))
   return jsonify(without_cvrs)

@app.route('/set-seed', methods=['POST'])
def set_seed():
   j = request.get_json()
   if 'seed' in j:
      global audit_state
      # global seed
      # global main_contest_in_progress
      audit_state['seed'] = j['seed']



      # 'ballot_type' is a misnomer here: TODO:
      ballot_types = []
      if audit_state['audit_type_name'] == 'ri_pilot':
          ballot_types = ['ballot_polling', 'ballot_comparison']
      else:
          ballot_types = [audit_state['audit_type_name']]

      for ballot_type in ballot_types:

          [], audit_state['ballot_ids'][ballot_type] = sampler.generate_outputs(seed=audit_state['seed'], with_replacement=False, n=(audit_state['num_ballots_already_sampled']+number_of_ballots_to_interpret[ballot_type]),a=(audit_state['num_ballots_already_sampled']+1),b=audit_state['total_number_of_ballots'][ballot_type],skip=0)
          audit_state['num_ballots_already_sampled'] += number_of_ballots_to_interpret[ballot_type]
          # At least in RI we will be running them in sorted order:
          #audit_state['ballot_ids'][ballot_type] = sorted(audit_state['ballot_ids'][ballot_type])

      for contest_name in audit_state['cvrs'].keys():
          imprint_dict = {}
          for ballot_id in audit_state['ballot_ids'][contest_name]:
              imprint_dict[ballot_id] = audit_state['cvrs'][contest_name][ballot_id-1]['Serial Number']
          audit_state['imprinted_ids'][contest_name] = imprint_dict

      # This is a special case, due to running several different audit types
      #   in the 2019 RI pilot:
      # TODO: find a better place for this kind of configuration (maybe!):
      if 'ballot_polling' in audit_state['ballot_ids']:
          x = audit_state['ballot_ids']['ballot_polling']
          audit_state['ballot_ids']['ballot_polling'] = sorted(x[0:64])+sorted(x[64:(64+8)])+sorted(x[(64+8):(64+8+64)])+sorted(x[(64+8+64):(64+8+64+64)])
      if 'ballot_comparison' in audit_state['ballot_ids']:
          x = audit_state['ballot_ids']['ballot_comparison']
          audit_state['ballot_ids']['ballot_comparison'] = sorted(x[0:50])+sorted(x[50:100])

      return '' # jsonify({'ballot_ids': audit_state['ballot_ids'][ballot_type]}) # TODO: do we want to return anything here?
   else:
      return 'Key "seed" is not present', 422


@app.route('/get-ballot-ids')
def get_ballot_ids():
    return jsonify({'ballot_ids': audit_state['ballot_ids']})

@app.route('/ballot-pull-sheet-<contest_type>.txt')
def get_ballot_pull_sheet(contest_type):
    s = 'ballot_id,batch_id,index_in_batch,imprinted_id'
    for ballot_id in audit_state['ballot_ids'][contest_type]:
        s += '\n'+get_pull_sheet_row(contest_type, audit_state['ballot_manifest'][contest_type], ballot_id, ballot_id)
    return Response(s, mimetype='text/plain')

def get_pull_sheet_row(contest_type, manifest_orig, ballot_id, n):
    # TODO: we're repeatedly copying, which isn't needed
    manifest = copy.deepcopy(manifest_orig)
    row = manifest[0]
    if n <= row['num_sheets']:
        s = str(ballot_id)
        s += ','+row['batch_id']
        s += ','+str(n)
        s += ','
        if contest_type in audit_state['cvrs']:
            s += audit_state['cvrs'][contest_type][ballot_id-1]['Serial Number']
        return s
    else:
        # TODO: make sure you don't hit recursion limit:
        return get_pull_sheet_row(contest_type, manifest[1:], ballot_id, n - row['num_sheets'])


### "Interpretation handlers"
# (Not git-adding yet)
@app.route('/get-audit-status', methods=['POST'])
def get_audit_status():
    j = request.get_json()
    # x = audit_types[audit_state['audit_type_name']]['get_results']()
    x = audit_types[j['contest_type']]['get_results']()
    print(x)
    return x

def make_manifest_row(r):
    d = {
        'batch_id': r['Batch ID'],
        'num_sheets': int(r['# of Sheets']),

        'first_imprinted_id': r['First Imprinted ID'],
        'last_imprinted_id': r['Last Imprinted ID'],
        'municipality': r['Municipality'],
        'precinct_num': r['Precinct Number'],
        'box_letter': r['Box Letter'],
        'folder_num': r['Folder Number'],
        }
    if d['first_imprinted_id'].isdigit():
        d['first_imprinted_id'] = int(d['first_imprinted_id'])
    if d['last_imprinted_id'].isdigit():
        d['last_imprinted_id'] = int(d['last_imprinted_id'])
    return d

@app.route('/upload-ballot-manifest', methods=['POST'])
def upload_ballot_manifest():
    # "Be conservative in what you send, be liberal in what you accept"
    # TODO: for transparency, also return the file's hash
    if 'file' not in request.files:
        return 'File not uploaded', 400
    file = request.files['file']
    contest_name = request.form['contest_name']
    # "if user does not select file, browser also"
    # "submit an empty part without filename"
    if file.filename == '':
        return 'No selected file', 400
    if file: # and allowed_file(file.filename):
        filename = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
        file.save(filename)
        with open(filename, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            rows = [ make_manifest_row(r) for r in reader ]
            global audit_state
            audit_state['total_number_of_ballots'][contest_name] = sum([ r['num_sheets'] for r in rows ])
            audit_state['ballot_manifest'][contest_name] = rows
            # TODO: data integrity checks!
            # both for matching with CVR data (counts etc), and with the counts (first_printed_id adds to num_sheets etc)
            return jsonify(rows) # todo: don't return this?

@app.route('/reset-audit-state', methods=['POST'])
def reset_audit_state():
    global audit_state
    audit_state = copy.deepcopy(default_audit_state)
    return ''

@app.route('/reset')
def send_reset_page():
    return send_from_directory('ui', 'reset_page.html')

@app.route('/upload-cvr-file', methods=['POST'])
def upload_cvr():
    contest_name = request.form['contest_name']
    if 'file' not in request.files:
        return 'File not uploaded', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    if file:
        filename = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
        file.save(filename)
        with open(filename, newline='') as csvfile:
            reader = csv.DictReader(csvfile)

            # TODO: we can do this more efficiently than holding it all in RAM:
            rows = [ dict(r) for r in reader ]
            print(rows[:5])

            # TODO: check that the CVR file matches the reported results

            audit_state['cvrs'][contest_name] = rows
            cvr_hash = 'test-hash' # TODO
            audit_state['cvr_hash'][contest_name] = cvr_hash
            return jsonify({'cvr_hash': cvr_hash})

@app.route('/timestamp-event', methods=['POST'])
def log_time():
   j = request.get_json()
   fname = os.path.join(audit_log_dir, audit_state['audit_name']+'_timestamp-events.txt')
   with open(fname, 'a') as states_file:
       states_file.write('\n'+str(tuple((datetime.now().isoformat(), j))))
   return ''

### Static files
@app.route('/jquery.js')
def jquery():
   # We only use this for '$.ajax'; remove?:
   return app.send_static_file('jquery-3.3.1.min.js')
@app.route('/bootstrap.js')
def bootstrap():
  # Used for error message div
  return app.send_static_file('bootstrap-3.4.0.min.js')
@app.route('/rla_ui.js')
def rla_ui_js():
   return send_from_directory('ui','rla_ui.js')
@app.route('/style.css')
def style_css():
   return send_from_directory('ui','style.css')
@app.route('/')
def index():
   return send_from_directory('ui','index.html')

