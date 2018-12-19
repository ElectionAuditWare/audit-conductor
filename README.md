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

Todo!

  - (mini)conda
  - pip
  - Debian/Ubuntu packages

## Tests

You can run the tests by calling

    pytest test/test.py

## Usage

You can try out the prototype UIs by opening these files in your browser:

 * [enter_seed](ui/sketches/enter_seed/)
 * [enter interpretations](ui/sketches/enter_interpretations/)
