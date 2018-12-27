# Keep it simple!
# 
# "There are two ways of constructing a software design: One way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies." - C.A.R. Hoare

  # TODO:
  # un-hardcode sampler parameters
  # load state to and from file
  # make UI is more of a dumb terminal so we can e.g. force-refresh the page
  # big red error box on any failure
  # log all data (in a parseable format, and with timestamps)
    # 'SET_SEED'
    # 'ADD_INTERPRETATION'
  # don't create more than one ballot div to interpret (e.g. if you go back and revise an old one)
  # load candidates (etc) from CVR
    # ballot manifest
  # disallow submission if you don't have all interpretations entered
  # Write-in candidates
  # translate from ballot # to batch location
  # feed seed thing in -- get real ballot numbers


from flask import Flask, jsonify, request, url_for, send_from_directory

# https://docs.python.org/3/library/typing.html
from typing import List, Dict

import os
# os.sys.path.append('../RIWAVE/WAVE')
# os.sys.path.append('RIWAVE/WAVE/audit')
# os.sys.path.append('RIWAVE/WAVE')
# import BallotPolling
# self._tolerance

# todo: get the sampler from the source instead of OpenRLA's copy:
os.sys.path.append('OpenRLA/rivest-sampler-tests')
#from sampler import generate_outputs
# TODO: in the future, replace this with consistent_sampler:
import sampler

app = Flask(__name__, static_url_path='')

Interpretation = Dict[str, List[Dict[str, str]]]

allInterpretations = []
seed = None

# bp=BallotPolling.BallotPolling()

# TODO: log code version (hash), date, etc

@app.route('/add-interpretation', methods=['POST'])
def add():
   data = request.get_json()
   app.logger.debug(data)
   if 'interpretation' in data:
      global allInterpretations
      allInterpretations.append(data['interpretation'])
      return ''
   else:
      return 'Key "interpretation" is not present in the request', 422

@app.route('/get-all-interpretations')
def get():
   global allInterpretations
   return str((allInterpretations)) # , bp._ballot_count, seed))

@app.route('/set-seed', methods=['POST'])
def set_seed():
   j = request.get_json()
   if 'seed' in j:
      global seed
      seed = j['seed']
      # TODO: un-hardcode these values:
      [], ballot_ids = sampler.generate_outputs(seed=seed, with_replacement=False, n=10,a=0,b=10000,skip=0)
      # TODO: log action
      return jsonify({'ballot_ids': ballot_ids})
   else:
      return 'Key "seed" is not present', 422

### "Interpretation handlers"
# (Not git-adding yet)


### Static files
# Many of these -- or at least their locations -- are temporary:
@app.route('/jquery.js')
def jquery():
   return app.send_static_file('jquery-3.3.1.min.js')
@app.route('/rla_ui.js')
def rla_ui_js():
   return send_from_directory('ui','rla_ui.js')
# temporary
@app.route('/cumberland.json')
def cumberland_json():
   return send_from_directory('ui/sketches/enter_interpretations','cumberland.json')
@app.route('/style.css')
def style_css():
   return send_from_directory('ui/sketches','style.css')
@app.route('/')
def index():
   return send_from_directory('ui','index.html')

