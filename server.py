# Keep it simple!
# 
# "There are two ways of constructing a software design: One way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies." - C.A.R. Hoare

  # TODO:
  # load state to and from file
  # make UI is more of a dumb terminal so we can e.g. force-refresh the page
  # big red error box on any failure
  # log all data (in a parseable format, and with timestamps)
  # don't create more than one ballot div to interpret (e.g. if you go back and revise an old one)
  # labels (names of candidates) should be clickable
  # load candidates (etc) from CVR
    # ballot manifest
  # disallow submission if you don't have all interpretations entered
  # Write-in candidates


from flask import Flask, jsonify, request, url_for, send_from_directory

# https://docs.python.org/3/library/typing.html
from typing import List, Dict

app = Flask(__name__, static_url_path='')

Interpretation = Dict[str, List[Dict[str, str]]]

allInterpretations = []

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
   return str(allInterpretations)

### "Interpretation handlers"
# (Not git-adding yet)


### Static files
# Many of these -- or at least their locations -- are temporary:
@app.route('/jquery.js')
def jquery():
   return app.send_static_file('jquery-3.3.1.min.js')
@app.route('/rla_ui.js')
def rla_ui_js():
   return send_from_directory('ui/sketches/enter_interpretations','rla_ui.js')
# temporary
@app.route('/cumberland.json')
def cumberland_json():
   return send_from_directory('ui/sketches/enter_interpretations','cumberland.json')
@app.route('/style.css')
def style_css():
   return send_from_directory('ui/sketches','style.css')
@app.route('/')
def index():
   return send_from_directory('ui/sketches/enter_interpretations','index.html')

