'use strict';

// TODO:
//   - Don't use 'innerHTML'

// Contest IDs cannot contain "strange" characters
//   (Either define this more carefully or just limit to "a-z0-9_-")


(function(){

var highestBallot = 1; // global mutable state?! TODO: remove
var conductorState = {};
var uiState = {
     // 'contest_type': null,
     'have_displayed_pull_list': false,
   };

// var ballotManifest;

var completedBallots = [];
// Once we set this we don't remove elements from it:
var ballotsToInspect = [];

// container divs:
var contestNameContainer;
var seedContainer;
var contestTypeContainer;
var finalResultContainer;
var cvrUploadContainer;
var ballotManifestUploadContainer;

// TODO: WRITE TESTS FOR THIS FUNCTION!:
// Particularly edge cases like first and last of a batch etc:
var ballotNumToLocation;

window.onload = function() {
   contestNameContainer = document.getElementById('contestNameContainer');
   seedContainer = document.getElementById('seedContainer');
   contestTypeContainer = document.getElementById('contestTypeContainer');
   finalResultContainer = document.getElementById('finalResultContainer');
   cvrUploadContainer = document.getElementById('cvrUploadContainer');
   ballotManifestUploadContainer = document.getElementById('ballotManifestUploadContainer');

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

function mainLoop() {
   if (conductorState['contest_type_name'] === null) {
      console.log(conductorState['contest_type_name']);
      chooseContestType();
   } else if (conductorState['contest_name'] === null) {
      enterContestName();
   } else if (conductorState['ballot_manifest'] === null) {
      uploadBallotManifest(); // TODO: when?
   } else if (conductorState['seed'] === null) {
      enterSeed();
   } else { // TODO
     // Now we can start inputting interpretations:
     makeNewBallot();
   }
}

function chooseContestType() {
   $.ajax({
      url: '/get-contest-types',
      method: 'GET',
      contentType: 'application/json',
   }).done(function(msg) {
      var types = msg['types'];
      var contestTypeSelect = document.createElement('select');
      var saveButton = document.createElement('button');
      ([''].concat(types)).forEach(function(contestType) {
         var opt = document.createElement('option');
         opt.value = contestType;
         opt.innerHTML = contestType;
         contestTypeSelect.appendChild(opt);
      });
      saveButton.value = 'Save';
      saveButton.innerHTML = 'Save';
      contestTypeContainer.appendChild(contestTypeSelect);
      contestTypeContainer.appendChild(saveButton);
      saveButton.onclick = function() {
         if(contestTypeSelect.selectedIndex > 0) {
            // "- 1" because of the first "" option:
            var typeChoice = types[contestTypeSelect.selectedIndex - 1];
            if ((typeof(typeChoice) != 'undefined') && (typeChoice != "")) {
               $.ajax({
                  url: '/set-contest-type',
                  method: 'POST',
                  contentType: 'application/json',
                  data: JSON.stringify({'type': typeChoice}),
               }).done(function() {
                  contestTypeContainer.innerHTML = 'Contest type: <strong>' + typeChoice + '</strong>';
                  contestTypeContainer.classList.add('complete');
                  // uiState['contest_type_name'] = typeChoice;
                  getConductorState(mainLoop); // this'll now have 'contest_type_name'
               }).fail(reportError);
            };
         };
      };
      }).fail(reportError);
}



function enterContestName() {
   var saveButton = document.getElementById('contestNameSaveButton');
   var nameBox = document.getElementById('contestNameBox'); // 'Box' might sound like it's a div -- rename?
   contestNameContainer.style.display = 'block';
   nameBox.focus();
   saveButton.onclick = function() {
      if(nameBox.value != '') {
         $.ajax({
            url: '/set-contest-name',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({'contest_name': nameBox.value}),
         }).done(function() {
            // uiState['contest_name'] = nameBox.value;
            getConductorState(function(){
               contestNameContainer.innerHTML = 'Contest name: <strong>' + conductorState['contest_name'] + '</strong>';
               contestNameContainer.classList.add('complete');
               mainLoop();
            });
         }).fail(reportError);
      };
   };
}

function uploadBallotManifest() {

   ballotManifestUploadContainer.style.display = 'block';


   var uploadButton = document.getElementById('uploadBallotManifestButton');
   var uploadForm = document.getElementById('uploadBallotManifestForm');

   $(uploadButton).click(function() {
      var form_data = new FormData(uploadForm);
      $.ajax({
         type: 'POST',
         url: '/upload-ballot-manifest',
         data: form_data,
         contentType: false,
         cache: false,
         processData: false,
         success: function() { // ballotM) {
            // console.log(ballotM);
            ballotManifestUploadContainer.innerHTML = '(Ballot Manifest Added)';
            ballotManifestUploadContainer.classList.add('complete');
            // ballotManifest = ballotM;

            getConductorState(function() {
               // TODO: make this a toplevel (and well-tested) function which
               //   takes the manifest as an arg:
               ballotNumToLocation = function(ballotNum) {
                  var n, manifest, finished;
                  n = ballotNum;
                  manifest = conductorState['ballot_manifest'].slice(); // copy-by-value so we can '.shift()'
                  finished = false;
                  //console.log(manifest);
                  //console.log(ballotManifest);
                  do {
                     // TODO: test it's not an empty list:
                     if (n <= manifest[0]['num_sheets']) {
                        finished = true; // needed?
                        return 'Batch ID: '+manifest[0]['batch_id']+', imprinted ID: '+(manifest[0]['first_imprinted_id']+n);
                     } else {
                        n = n - manifest[0]['num_sheets'];
                        manifest.shift();
                     }
                  } while (finished == false);
               };
               mainLoop();
            });
         },
      });
   });
}

function enterSeed() {
   var saveButton, seedTextBox, ballotListDiv;
   seedContainer.style.display = 'block';
   saveButton = document.getElementById('seedSaveButton');
   seedTextBox = document.getElementById('seedTextBox');
   ballotListDiv = document.getElementById('listOfBallotsToPull');

   seedTextBox.focus();

   saveButton.onclick = function() {
      var ballotOl, seed;
      // TODO: careful with malicious/surprising input!:
      seed = seedTextBox.value;

      $.ajax({
         url: '/set-seed',
         data: JSON.stringify({'seed': seed}),
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(msg){
         ballotsToInspect = msg['ballot_ids'];

         ballotOl = buildOrderedList(ballotsToInspect);

         seedContainer.innerHTML = 'Seed: <strong>'+seed+'</strong>';
         seedContainer.classList.add('complete');
         ballotListDiv.style.display = 'block';
         
         ballotListDiv.appendChild(document.createTextNode('Ballot order:'));
         ballotListDiv.appendChild(ballotOl);
         
         ballotListDiv.appendChild(document.createTextNode('Sorted order:'));
         // '.slice' is so we can have a non-destructive sort:
         ballotListDiv.appendChild(buildOrderedList(ballotsToInspect.slice().sort(function (a, b) {  return a - b;  }))); // numeric sort

         var pullSheetText = document.createTextNode('Ballot Pull Sheet...');
         var a = document.createElement('a');
         a.href = '/ballot-pull-sheet.txt';
         a.target = '_blank';
         a.appendChild(pullSheetText);
         ballotListDiv.appendChild(a);

         getConductorState(mainLoop);


      })
      .fail(reportError);
   };
}

function buildOrderedList(elems) {
   var ol = document.createElement('ol');
 
   elems.forEach(function(elem) {
      let el = document.createElement('li');
      el.innerHTML = elem;
      ol.appendChild(el);
   });

   return ol;
  
}



// TODO: better name because there's also 'newBallot':

function makeNewBallot() {
   var ballotIdsLeft = ballotsToInspect.filter(function(x) {
      return !(completedBallots.includes(x)); // .indexOf(x) < 0;
   });
   // console.log(ballotIdsLeft, completedBallots);
   if (ballotIdsLeft.length == 0) {
      $.ajax({
         url: '/get-audit-status',
         method: 'POST',
         data: JSON.stringify({}),
         contentType: 'application/json'
      }).done(function(msg) {
         // console.log(msg);
         finalResultContainer.innerHTML = 'Audit complete! Status: <strong>'+msg['status']+'</strong> ('+msg.progress+')';
         finalResultContainer.style.display = 'block';
         window.scrollTo(0,document.body.scrollHeight); // scroll to the bottom
      }).fail(reportError);
   } else {
      var ballot_entries = document.getElementById('ballot_entries');
      var ballot_id = ballotIdsLeft[0];
      ballot_entries.appendChild(newBallot(ballot_id));
   }
}

function newBallot(ballot_id) {
   var ballot, numberLabel, innerForm, ballotNumber;
   ballot = document.createElement('div');
   numberLabel = document.createElement('div');
   innerForm = newInnerForm(ballot_id);

   ballot.classList.add('ballot', 'inProgress', 'container');

   numberLabel.classList.add('numberLabel', 'inProgress');
   numberLabel.innerText = 'Ballot # '+highestBallot+', ID: '+ballot_id+', Location: '+ballotNumToLocation(ballot_id); // TODO: 'innerText' may not be cross-browser
   highestBallot += 1;

   numberLabel.onclick = function(event) {
      if (innerForm.style.display === 'none') {
         innerForm.style.display = 'block';
         // TODO: 'includes' may be too new for some browsers:
      } else if (completedBallots.includes(ballot_id)) {
         innerForm.style.display = 'none';
      }
      // window.event.stopPropagation();
      event.stopPropagation();
   };

   ballot.appendChild(numberLabel);
   ballot.appendChild(innerForm);

   return ballot;
};

function newInnerForm(ballot_id) {

   var innerForm, saveButton;
   innerForm = document.createElement('div');
   saveButton = document.createElement('button');
   saveButton.innerHTML = 'Save';

 
   innerForm.classList.add('innerForm');

   conductorState['all_contests'].forEach(function(contest) {
      var contestBox = newRaceCheckbox(ballot_id, contest.id, contest.title, contest.candidates);
      innerForm.appendChild(contestBox);
   });

   innerForm.appendChild(saveButton);

   saveButton.onclick = function(event) {
      var that = this;
      var dat = {ballot_id: ballot_id, contests: {}};
      conductorState['all_contests'].forEach(function(contest) {
         var x = document.querySelector('input[name="'+contestCheckboxName(ballot_id, contest.id)+'"]:checked').value;
         dat['contests'][contest.id] = x;
      });
      // console.log(dat);
      // TODO: to be extra safe here, distinguish between first click (create) and
      //   others (update) when calling jquery.ajax (maybe {update:true}?)
      $.ajax({
         url: '/add-interpretation',
         data: JSON.stringify({'interpretation': dat}),
         // dataType: 'json',
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(msg){
         completedBallots.push(ballot_id);
         that.parentNode.parentNode.classList.replace('inProgress','complete');
         innerForm.style.display = 'none';
         // TODO: for the pilot we don't need to check the stopping condition
         //   on each interpretation, since we're running for a fixed number of
         //   ballots. In most audits, though, you'd want to check for that
         //   here:
         makeNewBallot(); // TODO: don't do this if you're clicking to save a second time and we already have an unfinished one
         // window.event.stopPropagation();
         event.stopPropagation();
      })
      .fail(reportError);
   }

   return innerForm;
};

function newRaceCheckbox(ballot_id, race_id, race_title, race_choices) {
   var div, ul;
   div = document.createElement('div');
   div.innerText = race_title;
   div.classList.add('raceDiv');

   ul = document.createElement('ul');
   ul.setAttribute('style', 'list-style-type: none');
   div.appendChild(ul);

   race_choices.concat(['Write-in candidate', 'No selection (undervote)', 'Overvote']).forEach(function(choice,i) {
      var checkbox,label,li;
      checkbox = document.createElement('input');
      checkbox.type = 'radio'; // 'checkbox';
      checkbox.name = contestCheckboxName(ballot_id, race_id);
      // TODO: better-guarantee that these are unique
      // (Almost definitely not a concern for RI):
      checkbox.id = ballot_id+'#'+race_id+'#'+race_title+'#'+i;
      checkbox.classList.add('choiceCheckbox');
      checkbox.value = choice;

      label = document.createElement('label');
      label.innerHTML = choice; // again, careful!
      label.setAttribute('for', checkbox.id);
      label.classList.add('choiceCheckboxLabel');

      li = document.createElement('li');

      li.appendChild(checkbox);
      li.appendChild(label);
      ul.appendChild(li);
   });
   return div;
}

function contestCheckboxName(ballot_id, contest_id) {
   return ballot_id+'#'+contest_id; // +'#'+race_title;
}

// TODO: big red error box here:
function reportError(e) {
   alert('AJAX failure!: '+JSON.stringify(e));
}

})();
