'use strict';

// TODO:
//   - Don't use 'innerHTML'
//   - Use 'parentNode' less

// Contest IDs cannot contain "strange" characters
//   (Either define this more carefully or just limit to "a-z0-9_-")


(function(){

var debugMode = true;

if (debugMode) {
   //alert('Note: running in debug mode!');
};

var conductorState = {};
// The UI may be out of sync with the server. For example, you could
//   hard-refresh your browser window, and then no frontend representations
//   of the data that's still on the backend would (yet) exist. 'uiState' is
//   mainly a way of tracking where the UI is:
var uiState = {
   'have_displayed_pull_list': false,

   'last_finished_audit_step': null,

/*
   'got_audit_type': false,
   'got_audit_name': false,
   'got_cvr': false,
   'got_ballot_manifest': false,
   'got_cvr_file': false,
   'got_seed': false,
   'created_finished_ballots': false,
*/

   'interpretation_to_confirm': null,
   };


// container divs:
var auditNameContainer;
var seedContainer;
var auditTypeContainer;
// var finalResultContainer;
var cvrFileUploadContainer;
var ballotManifestUploadContainer;
var ballotListDiv; // rename for consistency?
var ballotEntriesContainer;

// Couple helpers to make the code shorter:
function newElem(elemType) {
   return document.createElement(elemType);
}
function getById(nodeId) {
   return document.getElementById(nodeId);
};

window.onload = function() {
   auditNameContainer = getById('auditNameContainer');
   seedContainer = getById('seedContainer');
   auditTypeContainer = getById('auditTypeContainer');
   //finalResultContainer = getById('finalResultContainer');
   cvrFileUploadContainer = getById('cvrFileUploadContainer');
   ballotManifestUploadContainer = getById('ballotManifestUploadContainer');
   ballotListDiv = getById('listOfBallotsToPull');
   ballotEntriesContainer = getById('ballotEntriesContainer');

   getConductorState(mainLoop);
/*
   $.ajax({
      url: '/get-contests',
      method: 'GET',
      contentType: 'application/json',
   }).done(function(msg) {
      all_contests = msg['contests'];
*/
   // }).fail(reportError);
};

// The backend (conductor.py) is the source of truth so we fetch it directly
//   when we need it:
function getConductorState(andThen) {
   $.ajax({
      url: '/get-audit-state',
      method: 'POST',
      contentType: 'application/json',
   }).done(function(msg) {
      console.log('conductor state', msg);
      conductorState = msg;
      andThen();
   }).fail(reportError);
}

var auditSteps = {
      'ballot_polling': [
            maybeGetAuditName,
            maybeGetBallotManifest('ballot_polling'),
            maybeGetSeed,
            displayPullSheet('ballot_polling'),
            createButton('Click to enter interpretations'),
            createFinishedBallots('ballot_polling'),
            makeNewBallotOrReturnResults('ballot_polling'),
         ],
      'ballot_comparison': [
            maybeGetAuditName,
            maybeGetBallotManifest('ballot_comparison'),
            maybeGetCVRFile('ballot_comparison'),
            maybeGetSeed,
            displayPullSheet('ballot_comparison'),
            createButton('Click to enter interpretations'),
            createFinishedBallots('ballot_comparison'),
            makeNewBallotOrReturnResults('ballot_polling'),
         ],
      'ri_pilot': [
            maybeGetAuditName,
            announce('Ballot Polling (Portsmouth) data entry'),
            maybeGetBallotManifest('ballot_polling'),
            announce('Ballot Comparison (Bristol) data entry'),
            maybeGetBallotManifest('ballot_comparison'),
            maybeGetCVRFile('ballot_comparison'),
            maybeGetSeed,
            displayPullSheet('ballot_polling'),
            displayPullSheet('ballot_comparison'),
            createButton('Click to enter Ballot Polling (Portsmouth) interpretations'),
            createFinishedBallots('ballot_polling'),
            makeNewBallotOrReturnResults('ballot_polling'),
            createButton('Click to enter interpretations'),
            createFinishedBallots('ballot_comparison'),
            makeNewBallotOrReturnResults('ballot_comparison'),
         ],
   };

function maybeGetAuditType(andThen) {
   if ( ! uiState['got_audit_type']) {
      var auditType = conductorState['audit_type_name'];
      if (auditType === null) {
         chooseAuditType();
      } else {
         displayAuditType();
         //mainLoop();
         andThen();
      }
   } else {
      andThen();
   }
};

// These 'maybeGet*' functions are repetitive -- make a helper function for them:

function maybeGetAuditName() {
   //if ( ! uiState['got_audit_name']) {
      var auditName = conductorState['audit_name'];
      if (auditName === null) {
         enterAuditName();
      } else {
         displayAuditName();
         mainLoop();
      }
   //}
};

function maybeGetBallotManifest(ballotType) {
   return function () {
   //if ( ! uiState['got_ballot_manifest'] ) {
      // if (conductorState['ballot_manifest'] === null) {
      if (conductorState['ballot_manifest'][ballotType] === undefined) {
         uploadBallotManifest(ballotType); // TODO: when?
      } else {
         displayBallotManifest(ballotType);
         mainLoop();
      }
   //}
   }
};

function maybeGetCVRFile(ballotType) {
   return function () {
   //if ((conductorState['audit_type_name'] == 'ballot_comparison') && ( ! uiState['got_cvr_file'] )) {
      //if (conductorState['cvr_hash'] === null) {
      if (conductorState['cvr_hash'][ballotType] === undefined) {
         uploadCVRFile(ballotType);
      } else {
         displayCVRFile(ballotType);
         mainLoop();
      }
   //}
   }
};

function maybeGetSeed() {
   //if ( ! uiState['got_seed'] ) {
      if (conductorState['seed'] === null) {
         enterSeed();
      } else {
         displaySeed();
         mainLoop();
      }
   //}
};


function mainLoop() {
   maybeGetAuditType(function() {
      var steps = auditSteps[conductorState['audit_type_name']];
      if (uiState['last_finished_audit_step'] === null) {
         uiState['last_finished_audit_step'] = 0;
         steps[0]();
      } else {
         if (uiState['last_finished_audit_step'] < (steps.length - 1)) {
            uiState['last_finished_audit_step']++; // Technically not 'finished' here
            steps[uiState['last_finished_audit_step']]();
            // For now they each call it themselves (seems more flexible):
            // mainLoop();
         };
      };
   });
}

function auditTypePrettyName(realName) {
   var prettyNames = {
      'ballot_polling': 'Ballot Polling',
      'ballot_comparison': 'Ballot Comparison',
      'ri_pilot': 'RI 2019 Pilot',
      };
   return prettyNames[realName] || realName;
};

function createButton(buttonMessage) {
   return function() {
      var container = newElem('div');
      container.classList.add('container');
      var button = newElem('button');
      var msg = document.createTextNode(buttonMessage);
      button.appendChild(msg);
      container.appendChild(button);
      button.onclick = function() {
         // container.parentNode.removeChild(container);
         container.remove();
         mainLoop();
      };
      document.body.appendChild(container);
   }
};


function announce(announcement) {
   return function() {
      console.log('a', announcement);
      var container = newElem('div');
      container.classList.add('container');
      var msg = document.createTextNode(announcement);
      container.appendChild(msg);
      document.body.appendChild(container);
      mainLoop();
   }
};

function chooseAuditType() {
   $.ajax({
      url: '/get-audit-types',
      method: 'GET',
      contentType: 'application/json',
   }).done(function(msg) {
      var types = msg['types'];
      var auditTypeSelect = newElem('select');
      var saveButton = newElem('button');
      ([''].concat(types)).forEach(function(auditType) {
         var opt = newElem('option');
         opt.value = auditType;
         opt.innerHTML = auditTypePrettyName(auditType);
         auditTypeSelect.appendChild(opt);
      });
      saveButton.value = 'Save';
      saveButton.innerHTML = 'Save';
      auditTypeContainer.appendChild(auditTypeSelect);
      auditTypeContainer.appendChild(saveButton);
      saveButton.onclick = function() {
         if(auditTypeSelect.selectedIndex > 0) {
            // "- 1" because of the first "" option:
            var typeChoice = types[auditTypeSelect.selectedIndex - 1];
            if ((typeof(typeChoice) != 'undefined') && (typeChoice != "")) {
               $.ajax({
                  url: '/set-audit-type',
                  method: 'POST',
                  contentType: 'application/json',
                  data: JSON.stringify({'type': typeChoice}),
               }).done(function() {
                  // displayAuditType(typeChoice);
                  getConductorState(function() {
                     displayAuditType();
                     mainLoop(); // this'll now have 'contest_type_name'
                  });
               }).fail(reportError);
            };
         };
      };
      }).fail(reportError);
}


function displayAuditType() { // typeChoice) {
   var typeChoice = conductorState['audit_type_name'];
   auditTypeContainer.innerHTML = 'Audit type: <strong>' + auditTypePrettyName(typeChoice) + '</strong>';
   auditTypeContainer.classList.add('complete');

   //uiState['got_audit_type'] = true;
}


function enterAuditName() {
   var saveButton = getById('auditNameSaveButton');
   var nameBox = getById('auditNameBox'); // 'Box' might sound like it's a div -- rename?
   auditNameContainer.style.display = 'block';
   nameBox.focus();
   saveButton.onclick = function() {
      if(nameBox.value != '') {
         $.ajax({
            url: '/set-audit-name',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({'audit_name': nameBox.value}),
         }).done(function() {
            // uiState['audit_name'] = nameBox.value;
            getConductorState(function(){
               displayAuditName(); // conductorState['contest_name']);
               mainLoop();
            });
         }).fail(reportError);
      };
   };
}

function displayAuditName() {
   auditNameContainer.style.display = 'block';
   auditNameContainer.innerHTML = 'Audit name: <strong>' + conductorState['audit_name'] + '</strong>';
   auditNameContainer.classList.add('complete');
   //uiState['got_audit_name'] = true;
}

function uploadBallotManifest(ballotType) {

   ballotManifestUploadContainer.style.display = 'block';


   var uploadButton = getById('uploadBallotManifestButton');
   var uploadForm = getById('uploadBallotManifestForm');

   $(uploadButton).click(function() {
      var form_data = new FormData(uploadForm);
      form_data.append('contest_name', ballotType);
      $.ajax({
         type: 'POST',
         url: '/upload-ballot-manifest',
         data: form_data,
         contentType: false,
         cache: false,
         processData: false,
         success: function() { // ballotM) {
            // console.log(ballotM);
            // ballotManifest = ballotM;

            getConductorState(function() {
               displayBallotManifest(ballotType);
               mainLoop();
            });
         },
      }).fail(reportError);
   });
}

function displayBallotManifest (ballotType) {
   ballotManifestUploadContainer.style.display = 'block';
   ballotManifestUploadContainer.innerHTML = '(Ballot Manifest Added)';
   ballotManifestUploadContainer.classList.add('complete');
   // In the future, create it dynamically:
   document.body.appendChild(ballotManifestUploadContainer);

   //uiState['got_ballot_manifest'] = true;
}

// https://stackoverflow.com/questions/9716468/pure-javascript-a-function-like-jquerys-isnumeric
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// TODO: WRITE TESTS FOR THIS FUNCTION!:
// Particularly edge cases like first and last of a batch etc:
function ballotNumToLocation(fullManifest, ballotNum) {
   var n, manifest, finished;
   n = ballotNum;
   manifest = fullManifest.slice(); // copy-by-value so we can '.shift()'
   finished = false;
   do {
      var row = manifest[0]
      // TODO: test it's not an empty list:
      if (n <= row['num_sheets']) {
         finished = true; // needed?
         var s = 'Batch ID: '+ row['batch_id'];
         s += ' ballot ' + n;
/*
         s += ', batch number: ' + n; // TODO: more descriptive?
         if (isNumeric(row['first_imprinted_id'])) {
            s += ', imprinted ID: '+(row['first_imprinted_id']+n);
         };
         if (row['municipality'] != '') {
            // s += ', municipality: ' + row['municipality'];
            // to save space:
            s += ', ' + row['municipality'];
         };
         if (row['precinct_num'] != '') {
            s += ', precinct ' + row['precinct_num'];
         };
         if (row['box_letter'] != '') {
            s += ', box letter: ' + row['box_letter'];
         };
         if (row['folder_num'] != '') {
            s += ', folder ' + row['folder_num'];
         };
*/
         return s

      } else {
         n = n - manifest[0]['num_sheets'];
         manifest.shift();
      }
   } while (finished == false);
}

function uploadCVRFile(ballotType) {
   cvrFileUploadContainer.style.display = 'block';

   var uploadButton = getById('uploadCVRButton');
   var uploadForm = getById('uploadCVRForm');

   $(uploadButton).click(function() {
      var form_data = new FormData(uploadForm);
      form_data.append('contest_name', ballotType);
      $.ajax({
         type: 'POST',
         url: '/upload-cvr-file', // ?contest_name='+ballotType,
         data: form_data,
         contentType: false,
         cache: false,
         processData: false,
         success: function(data) {
            console.log('Success!');
            getConductorState(function() {
               displayCVRFile(ballotType);
               mainLoop();
            });
         },
      }).fail(reportError);
   });

}

function displayCVRFile(ballotType) {
   cvrFileUploadContainer.style.display = 'block';
   cvrFileUploadContainer.innerHTML = '(CVR file uploaded)';
   cvrFileUploadContainer.classList.add('complete');

   //uiState['got_cvr_file'] = true;
};

function enterSeed() {
   var saveButton, seedTextBox;
   seedContainer.style.display = 'block';
   saveButton = getById('seedSaveButton');
   seedTextBox = getById('seedTextBox');

   seedTextBox.focus();

   saveButton.onclick = function() {
      var seed;
      // TODO: careful with malicious/surprising input!:
      seed = seedTextBox.value;

      $.ajax({
         url: '/set-seed',
         data: JSON.stringify({'seed': seed}),
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(msg){
         getConductorState(function() {
            displaySeed();
            mainLoop();
         });
      })
      .fail(reportError);
   };
}

function displaySeed() {
// TODO: this can be split out into a couple of functions:



         seedContainer.innerHTML = 'Seed: <strong>'+conductorState['seed']+'</strong>';
         seedContainer.classList.add('complete');
         mainLoop();
}

function displayPullSheet(ballotType) {
   return function () {
         var ballotOl, ballotsToInspect;
         ballotsToInspect = conductorState['ballot_ids'][ballotType];
         ballotListDiv.style.display = 'block';
         
         // ballotListDiv.appendChild(document.createTextNode('Ballot order:'));
         // ballotOl = buildOrderedList(ballotsToInspect);
         // ballotListDiv.appendChild(ballotOl);
         
//         ballotListDiv.appendChild(document.createTextNode('Sorted order:'));
//         // '.slice' is so we can have a non-destructive sort:
//         ballotListDiv.appendChild(buildOrderedList(ballotsToInspect.slice().sort(function (a, b) {  return a - b;  }))); // numeric sort

         var pullSheetText = document.createTextNode('Ballot Pull Sheet... ('+ballotType+')'); // TODO: pretty
         var a = newElem('a');
         a.href = '/ballot-pull-sheet-'+ballotType+'.txt';
         a.target = '_blank';
         a.appendChild(pullSheetText);
         ballotListDiv.appendChild(a);

         //uiState['got_seed'] = true;
   }
}

function buildOrderedList(elems) {
   var ol = newElem('ol');
 
   elems.forEach(function(elem) {
      let el = newElem('li');
      el.innerHTML = elem;
      ol.appendChild(el);
   });

   return ol;
  
}



// TODO: better name because there's also 'newBallot':

function makeNewBallotOrReturnResults(ballotType) {
   // Less diff noise -- TODO:
   getConductorState(function(){ makeNewBallotOrReturnResultsPrime (ballotType)});
}

function makeNewBallotOrReturnResultsPrime(ballotType) {
   var ballotIdsLeft = conductorState['ballot_ids'][ballotType].filter(function(x) {
      return !(conductorState['all_interpretations'].map(function(y) { return y['ballot_id']; }).includes(x));
   });
   if (ballotIdsLeft.length == 0) {
      displayAuditStatus(function(){});
   } else {

      if (debugMode) {
         displayAuditStatus(function() { addBallot(ballotType, ballotIdsLeft[0]) });
      } else {
         addBallot(ballotType, ballotIdsLeft[0]);
      }

   }
}

function addBallot(ballotType, ballot_id) {
      var ballotDiv = newBlankBallot(ballotType, ballot_id);

      timestampEvent({'event': 'add_ballot', 'ballot_id': ballot_id});

      ballotDiv.appendChild(newInnerForm(ballotType, ballot_id));
      ballotDiv.classList.add('inProgress');

      // We append to body so we can interleave status in debug mode:
      //ballotEntriesContainer.appendChild(ballotDiv);
      document.body.appendChild(ballotDiv);
      scrollToTheBottom();
}

function displayAuditStatus(andThen) {
      var finalResultContainer = newElem('div');
      var progressBar = document.createTextNode('Computing audit status...')
      finalResultContainer.appendChild(progressBar);
      finalResultContainer.classList.add('container');
      document.body.appendChild(finalResultContainer);
      scrollToTheBottom();

      $.ajax({
         url: '/get-audit-status',
         method: 'POST',
         data: JSON.stringify({}),
         contentType: 'application/json'
      }).done(function(msg) {
         finalResultContainer.removeChild(progressBar);
         finalResultContainer.innerHTML = 'Audit status:';
         msg['outcomes'].forEach(function(outcome) {
            // 'all_contests' should probably be a dictionary so we don't need to do this filter[0]:
            var contest = conductorState['all_contests'].filter(function(x) {
               return x['id'] == outcome['contest_id'];
            })[0];
//OUT
            finalResultContainer.innerHTML += '<p>Contest: <strong>'+contest['title']+'</strong> Status: <strong>'+outcome['status']+'</strong> ('+outcome.progress+')</p>';
         });
         finalResultContainer.innerHTML += '<br /><br /><a href="/reset">Reset and audit another contest</a>';
         finalResultContainer.style.display = 'block';
         scrollToTheBottom();
         andThen();
      }).fail(reportError);

};


function scrollToTheBottom() {
   window.scrollTo(0,document.body.scrollHeight);
};

// todo: not 'blank': 'newBallotDiv'?:
function newBlankBallot(ballotType, ballot_id) {
   var ballot, numberLabel, innerForm, ballotNumber;
   ballot = newElem('div');
   ballot.classList.add('ballot', 'container');
   numberLabel = newElem('div');

   numberLabel.classList.add('numberLabel', 'inProgress');
   //numberLabel.innerText = 'Ballot # '+(conductorState['ballot_ids'].indexOf(ballot_id)+1)+', ID: '+ballot_id+', Location: '+ballotNumToLocation(conductorState['ballot_manifest'], ballot_id); // TODO: 'innerText' may not be cross-browser
   var ballotNum = conductorState['ballot_ids'][ballotType].indexOf(ballot_id) + 1;
   numberLabel.innerText = ballotNumToLocation(conductorState['ballot_manifest'], ballot_id) + ' (#'+ballotNum+')'; // TODO: 'innerText' may not be cross-browser

   numberLabel.onclick = function(event) {
      // This work in all IEs we need it to?:
      var resultDiv = ballot.querySelector('.resultDiv');
      if (typeof(resultDiv) !== 'undefined' && resultDiv !== null) {
         if (resultDiv.style.display === 'none') {
            resultDiv.style.display = 'block';
         } else {
            resultDiv.style.display = 'none';
         }
      }
/*
      if (innerForm.style.display === 'none') {
         innerForm.style.display = 'block';
         // TODO: 'includes' may be too new for some browsers:
      } else if (uiState['completed_ballots'].includes(ballot_id)) {
         innerForm.style.display = 'none';
      }
*/
      // window.event.stopPropagation();
      event.stopPropagation();
   };

   ballot.appendChild(numberLabel);
   // ballot.appendChild(innerForm);

   return ballot;
};

function newCompleteBallot(ballot_id) {
};

function createFinishedBallots(ballotType) {
   return function() {
   conductorState['all_interpretations'][ballotType].forEach(function(interpretationJSON) {
      var ballotDiv = newBlankBallot(ballotType, interpretationJSON['ballot_id']);

      ballotDiv.appendChild(candidateSelectionList(interpretationJSON));
      ballotDiv.classList.add('complete');

      ballotEntriesContainer.appendChild(ballotDiv);
   });
   //uiState['created_finished_ballots'] = true;
   mainLoop();
   }
};

function newInnerForm(ballotType, ballot_id) {

   var innerForm, saveButton;
   innerForm = newElem('div');
   saveButton = newElem('button');
   saveButton.innerHTML = 'Save';

 
   innerForm.classList.add('innerForm');

   conductorState['all_contests'].forEach(function(contest) {
      var contestBox = newRaceCheckbox(ballot_id, contest.id, contest.title, contest.candidates);
      innerForm.appendChild(contestBox);
   });

   innerForm.appendChild(saveButton);

   saveButton.onclick = function(event) {
      var dat = {ballot_id: ballot_id, contests: {}};

      timestampEvent({'event': 'click_first_save', 'ballot_id': ballot_id});

      conductorState['all_contests'].forEach(function(contest) {
         var x = document.querySelector('input[name="'+contestCheckboxName(ballot_id, contest.id)+'"]:checked').value;
         dat['contests'][contest.id] = x;
      });
      innerForm.parentNode.appendChild(newInterpretationConfirmation(ballotType, dat));
      innerForm.parentNode.removeChild(innerForm); // This has to be after the other '.parentNode's or they'll be null
   };
   return innerForm;
};

function newInterpretationConfirmation(ballotType, interpretationJSON) {
   var dat = interpretationJSON;
   var confirmationDiv = newElem('div');
   var confirmButton = newElem('button');
   var rejectButton = newElem('button');

   var ballot_id = interpretationJSON['ballot_id'];

   confirmButton.value = 'Confirm';
   confirmButton.innerHTML = 'Confirm';
   rejectButton.value = 'Reject';
   rejectButton.innerHTML = 'Reject';
   confirmationDiv.classList.add('confirmationDiv');

      // TODO: to be extra safe here, distinguish between first click (create) and
      //   others (update) when calling jquery.ajax (maybe {update:true}?)
   confirmButton.onclick = function(event) {
      $.ajax({
         url: '/add-interpretation',
         data: JSON.stringify({'interpretation': dat, 'contest_type': ballotType}),
         // dataType: 'json',
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(msg){
         timestampEvent({'event': 'click_final_save', 'ballot_id': ballot_id});
         confirmationDiv.parentNode.classList.replace('inProgress','complete');
         confirmationDiv.style.display = 'none';
         confirmButton.style.display = 'none';
         rejectButton.style.display = 'none';
         confirmationDiv.classList.add('resultDiv');
         // TODO: for the pilot we don't need to check the stopping condition
         //   on each interpretation, since we're running for a fixed number of
         //   ballots. In most audits, though, you'd want to check for that
         //   here:
         makeNewBallotOrReturnResults(ballotType); // TODO: don't do this if you're clicking to save a second time and we already have an unfinished one
         // window.event.stopPropagation();
         event.stopPropagation(); // Maybe unnecessary
      }).fail(reportError);
   };
   // Note we don't re-fill the existing radio buttons.
   //   That's intentional, although it could change based on the spec:
   rejectButton.onclick = function() {
      timestampEvent({'event': 'click_reject', 'ballot_id': ballot_id});
      confirmationDiv.parentNode.appendChild(newInnerForm(ballotType, ballot_id));
      confirmationDiv.parentNode.removeChild(confirmationDiv);
   };

   confirmationDiv.appendChild(candidateSelectionList(interpretationJSON));
   confirmationDiv.appendChild(rejectButton);
   confirmationDiv.appendChild(confirmButton);
   return confirmationDiv;
}

function candidateSelectionList(interpretationJSON) {
   var resultList = [];
/*
   for (var contestId in interpretationJSON['contests']) {
      resultList.push(contestId + ': ' + interpretationJSON['contests'][contestId]);
   }
*/
   conductorState['all_contests'].forEach(function(contest) {
      resultList.push(contest.title + ': ' + interpretationJSON['contests'][contest.id]);
   });
   return buildOrderedList(resultList);
};

function prettifyChoice(choiceName) {
   var choiceMap = {
      'Write-in': 'Write-in candidate',
      'undervote': 'No selection (undervote)',
      'overvote': 'Overvote',
      };
   return choiceMap[choiceName] || choiceName;
};

function newRaceCheckbox(ballot_id, race_id, race_title, race_choices) {
   var div, ul;
   div = newElem('div');
   div.innerText = race_title;
   div.classList.add('raceDiv');

   ul = newElem('ul');
   ul.setAttribute('style', 'list-style-type: none');
   div.appendChild(ul);
   race_choices.concat(['Write-in candidate', 'No selection (undervote)', 'Overvote']).forEach(function(choice,i) {
      if(!(race_id.includes('issue')&&choice.includes('Write-in'))){
      //race_choices.forEach(function(choice,i) {
      var checkbox, label, li;
      checkbox = newElem('input');
      checkbox.type = 'radio'; // 'checkbox';
      checkbox.name = contestCheckboxName(ballot_id, race_id);
      // TODO: better-guarantee that these are unique
      // (Almost definitely not a concern for RI):
      checkbox.id = ballot_id + '#' + race_id + '#' + race_title + '#' + i;
      checkbox.classList.add('choiceCheckbox');
      checkbox.value = choice;

      label = newElem('label');
      label.innerHTML = prettifyChoice(choice); // again, careful!
      label.setAttribute('for', checkbox.id);
      label.classList.add('choiceCheckboxLabel');

      li = newElem('li');

      li.appendChild(checkbox);
      li.appendChild(label);
      ul.appendChild(li);
      }
   });
   return div;
}

function timestampEvent(msg) {
      $.ajax({
         url: '/timestamp-event',
         data: JSON.stringify(msg),
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(){
      }).fail(reportError);
};

function contestCheckboxName(ballot_id, contest_id) {
   return ballot_id+'#'+contest_id; // +'#'+race_title;
}

// TODO: big red error box here:
function reportError(e) {
   alert('AJAX failure!: '+JSON.stringify(e));
}

})();
