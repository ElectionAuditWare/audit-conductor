# https://hypothesis.readthedocs.io/en/latest/quickstart.html

# set up one race
# input some data
# get out its updated data
# then set up another race
# get out its updated data

# then , set up both at the same time
# input the data once (for both)
# then get out the updated data for both races

# the results for the second 2 should be the same as the results for the first 2



# Test tools:
from hypothesis import given, settings, Verbosity, example

import hypothesis.strategies as st
import pytest


# Imports from jupyter notebook:
from collections import OrderedDict
from itertools import product
import math
import json

import numpy as np
import os
os.sys.path.append('../CORLA18/code')
from ballot_comparison import ballot_comparison_pvalue
#from CORLA18.code.ballot_comparison import ballot_comparison_pvalue
from fishers_combination import  maximize_fisher_combined_pvalue, create_modulus
from sprt import ballot_polling_sprt

from cryptorandom.cryptorandom import SHA256
from cryptorandom.sample import sample_by_index

from suite_tools import (write_audit_parameters, write_audit_results,
        check_valid_audit_parameters, check_valid_vote_counts,
        check_overvote_rates, find_winners_losers, print_reported_votes,
        estimate_n, estimate_escalation_n,
        parse_manifest, unique_manifest, find_ballot,
        audit_contest)
        

# At a high level, what we're doing is:
#   - Running an audit on contest A and collecting its results
#   - Running an audit on contest B and collecting its results
#   - Running, with interleaved commands, audits on contests A and B
#       simultaneously and collecting their results
#   - Testing that "interleaved A" returned the same results as
#       "non-interleaved A", and the same for contest B

# @settings(verbosity=Verbosity.verbose)
@given(st.decimals(0.001, 0.15),st.decimals(0.001, 0.15),
        #st.integers(500,500000),st.integers(500,500000),
        #st.integers(500,500000),st.integers(500,500000),
        st.lists(st.integers(10,50000), min_size=2, max_size=10),
        st.lists(st.integers(10,50000), min_size=2, max_size=10),
        st.lists(st.integers(10,50000), min_size=2, max_size=10),
        st.lists(st.integers(10,50000), min_size=2, max_size=10),
        # ,st.integers(500,500000),
        #st.integers(500,500000),st.integers(500,500000),

        # st.integers(2, 10), st.integers(2, 10),
        )
#@example(0.05, 0.05, 100000, 100000, 5000, 5000, 4, 4)
@example(0.05,0.05,[30000,50000,10000,500],[500,1000,500,10],[30000,50000,10000,500],[500,1000,500,10])
def test_suite_calculations_are_parallelizable(
        risk_limit_a, risk_limit_b,

        # Lists of integers of number of notes cast per candidate:
        reported_per_candidate_cvr_a_prezip,
        reported_per_candidate_no_cvr_a_prezip,
        reported_per_candidate_cvr_b_prezip,
        reported_per_candidate_no_cvr_b_prezip,

        #stratum_size_cvr_a, stratum_size_cvr_b,
        #stratum_size_no_cvr_a, stratum_size_no_cvr_b,
        #num_candidates_a, num_candidates_b,
        ):
    # We zip to make them the same size:
    all_reported_per_candidate_a = list(zip(
            reported_per_candidate_cvr_a_prezip,
            reported_per_candidate_no_cvr_a_prezip))
    all_reported_per_candidate_b = list(zip(
            reported_per_candidate_cvr_b_prezip,
            reported_per_candidate_no_cvr_b_prezip))

    # print(all_reported_per_candidate_a, all_reported_per_candidate_b)
    reported_per_candidate_cvr_a =    [ x[0] for x in all_reported_per_candidate_a ]
    reported_per_candidate_no_cvr_a = [ x[1] for x in all_reported_per_candidate_a ]
    reported_per_candidate_cvr_b =    [ x[0] for x in all_reported_per_candidate_b ]
    reported_per_candidate_no_cvr_b = [ x[1] for x in all_reported_per_candidate_b ]

    # (Can also write as):
    # reported_per_candidate_cvr_a, reported_per_candidate_no_cvr_a = zip(*x)

    stratum_size_cvr_a = sum(reported_per_candidate_cvr_a)
    stratum_size_no_cvr_a = sum(reported_per_candidate_no_cvr_a)
    stratum_size_cvr_b = sum(reported_per_candidate_cvr_b)
    stratum_size_no_cvr_b = sum(reported_per_candidate_no_cvr_b)
    stratum_sizes_a = [stratum_size_cvr_a,stratum_size_no_cvr_a]
    stratum_sizes_b = [stratum_size_cvr_b,stratum_size_no_cvr_b]
    # Not randomizing these for now:
    num_winners_a = 1 # 2
    num_winners_b = 1 # 2
    # Presumably will be using the same seed for all contests:
    seed = 12345678901234567890 
    gamma_a=1.03905 # "gamma from Lindeman and Stark (2012)"
    gamma_b=1.03905 # "gamma from Lindeman and Stark (2012)"
    lambda_step = 0.05 # "stepsize for the discrete bounds on Fisher's combining function"

    # These next 5 lines are directly from the notebook:
    # initial sample size parameters
    o1_rate = 0.002       # expect 2 1-vote overstatements per 1000 ballots in the CVR stratum
    o2_rate = 0           # expect 0 2-vote overstatements
    u1_rate = 0           # expect 0 1-vote understatements
    u2_rate = 0           # expect 0 2-vote understatements

    # Keeping this most similar to jupyter code although we could
    #   instead write e.g. 'stratum_size_cvr_a':
    n_ratio_a = stratum_sizes_a[0]/np.sum(stratum_sizes_a)
    n_ratio_b = stratum_sizes_b[0]/np.sum(stratum_sizes_b)
                         # allocate sample in proportion to ballots cast in each stratum

    check_valid_audit_parameters(risk_limit_a, lambda_step, o1_rate, o2_rate, u1_rate, u2_rate, stratum_sizes_a, n_ratio_a, num_winners_a)
    check_valid_audit_parameters(risk_limit_b, lambda_step, o1_rate, o2_rate, u1_rate, u2_rate, stratum_sizes_b, n_ratio_b, num_winners_b)

    # print(n_ratio_a)

    candidates_a = { 'candidate {}'.format(i): [cvr,no_cvr] for i, (cvr,no_cvr) in enumerate(all_reported_per_candidate_a,1) }
    candidates_b = { 'candidate {}'.format(i): [cvr,no_cvr] for i, (cvr,no_cvr) in enumerate(all_reported_per_candidate_b,1) }

    check_valid_vote_counts(candidates_a, stratum_sizes_a)
    check_valid_vote_counts(candidates_b, stratum_sizes_b)

    (candidates_a, margins_a, winners_a, losers_a) = find_winners_losers(candidates_a, num_winners_a)
    (candidates_b, margins_b, winners_b, losers_b) = find_winners_losers(candidates_b, num_winners_b)

    # import IPython
    # IPython.embed()
    check_overvote_rates(margins=margins_a, total_votes=sum(stratum_sizes_a), o1_rate=o1_rate, o2_rate=o2_rate)
    check_overvote_rates(margins=margins_b, total_votes=sum(stratum_sizes_b), o1_rate=o1_rate, o2_rate=o2_rate)


    # assert risk_limit_a == risk_limit_b

# test_suite_calculations_are_parallelizable(
#         risk_limit_a=0.05,
#         risk_limit_b=0.05,
#         reported_per_candidate_cvr_a_prezip=[30000, 50000, 10000, 500],
#         reported_per_candidate_no_cvr_a_prezip=[500, 1000, 500, 10],
#         reported_per_candidate_cvr_b_prezip=[30000, 50000, 10000, 500],
#         reported_per_candidate_no_cvr_b_prezip=[500, 1000, 500, 10])

# test_suite_calculations_are_parallelizable(risk_limit_a=0.0010000000000000000208166817117216851, risk_limit_b=0.0010000000000000000208166817117216851, reported_per_candidate_cvr_a_prezip=[10, 10], reported_per_candidate_no_cvr_a_prezip=[10, 10], reported_per_candidate_cvr_b_prezip=[10, 10], reported_per_candidate_no_cvr_b_prezip=[10 , 10])
