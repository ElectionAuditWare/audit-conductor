# 🗳️🔬🕵️ audit-conductor 🎼🎶🎻

Central repo for software to aid Rhode Island's January 2019 post-election pilot audit.

The aim is to re-implement as little as possible, and instead focus on
coordinating ("conducting") the behavior of pieces of existing software running
simultaneously and in tandem.

In the conductor analogy, the other repos (CORLA/SUITE, BCTool, BPTool) are the
musicians. We bring them in as submodules of our forks, so we can diverge
when needed but also have the option to easily merge back upstream. We can then
simply import them as python modules.

## Installation

In a python3 venv with python >= 3.4:

  - pip install hypothesis matplotlib numpy scipy cryptorandom pytest flask
  - git submodule update --init --recursive

Maybe todo:

  - (mini)conda
  - Debian/Ubuntu packages

## Upgrades:

If the `.gitmodules` file is updated, run this:

    git submodule sync

Any time one of the submodules might have changed, run

    git submodule update --init --recursive


## Tests

To run the tests, you'll need zerotest:

    pip install zerotest

You can run a "smoketest" of the server code by starting up the server (see Usage),
optionally capturing
the debug output (stdout and stderr), and then running these tests.
It currently makes a few dozen HTTP requests to set up the server and
enter 6 ballot interpretations, and checks the exact json responses to every request.

    pytest test/test_reset.py
    pytest test/test_comparison_setup.py
    # Manually visit http://127.0.0.1:5000 and upload the Bristol Manifest and CVR
    pytest test/test_comparison_acvrs.py

    # manually visit http://127.0.0.1:5000 and click on "Click to enter interpretations", and wait
    # for the results of "Computing audit status..." to be calculated
    # Stop the server if desired to stop logging stdout/stderr

TODO: Automate the file uploads
      Make it easier to ignore unimportant differences or update tests
        when the format of the json responses changes.
      Use Hypothesis to chain the tests together so plain old pytest would work

Older test of SUITE:

    pytest test/test.py

## Usage

    FLASK_APP=conductor.py flask run

## Other requirements

  - Browser: will not work with IE 8 (IE 9 came out in 2011)
    - document.querySelector(':checked')
    - Array.filter, Array.indexOf
    - Array.includes (maybe too new -- replace?)

