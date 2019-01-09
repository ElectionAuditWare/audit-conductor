"""Run tests of conductor server

Just a hack for now
"""


import sys
import logging
import types
import requests
import json
import pytest


def test_endpoint(ac, path, data=None):
    "GET path, or POST the given data to the given path"

    if data is None:
        r = ac.session.get(ac.base + path)
    else:
        r = ac.session.post(ac.base + path, json=data)

    if r.status_code == 200:
        logging.info("%s %s %s %s", r, "POST", path, r.text)
    else:
        logging.info("ERROR: %s %s %s %s", r, "POST", path, r.text)
    return r


def test_add_interpretation(ac):
    # var dat = {ballot_id: ballot_id, contests: {}}
    # for each: dat['contests'][contest.id] = x

    ballot_id = "sample-ballot-id"
    # contests = {contest.id: candidate  for contest,  in 
    contests = {'congress_district_1': 'Alex D. Marszalkowski'}
    interpretation = {'interpretation': {'ballot_id': ballot_id, 'contests': contests}}
    # for each: dat['contests'][contest.id] = x

    data = {'interpretation': interpretation}

    test_endpoint(ac, '/add-interpretation', data)


def main():

    ac = types.SimpleNamespace()

    ac.base = 'http://127.0.0.1:5000'
    ac.session = requests.Session()

    test_add_interpretation(ac)

if __name__ == "__main__":
    main()
