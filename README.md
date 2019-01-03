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

## Tests

You can run the tests by calling

    pytest test/test.py

## Usage

    FLASK_APP=conductor.py flask run

## Other requirements

  - Browser: will not work with IE 8 (IE 9 came out in 2011)
    - document.querySelector(':checked')
    - Array.filter, Array.indexOf
    - Array.includes (maybe too new -- replace?)

