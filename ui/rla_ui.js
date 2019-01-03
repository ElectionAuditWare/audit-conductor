'use strict';

// TODO:
//   - Don't use 'innerHTML'

// Contest IDs cannot contain "strange" characters
//   (Either define this more carefully or just limit to "a-z0-9_-")


(function(){

var highestBallot = 1; // global mutable state?! TODO: remove
var completedBallots = [];
// Once we set this we don't remove elements from it:
var ballotsToInspect = [];

//

var contestNameContainer;
var seedContainer;
var contestTypeContainer;
var finalResultContainer;
var cvrUploadContainer;
var ballotManifestUploadContainer;
var ballotManifest;

var contestType;

var contests;

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

   $.ajax({
      url: '/get-contests',
      method: 'GET',
      contentType: 'application/json',
   }).done(function(msg) {
      contests = msg['contests'];
      $.ajax({
         url: '/get-contest-types',
         method: 'GET',
         contentType: 'application/json',
      }).done(function(msg) {
         console.log(msg['types']);
         console.log(msg);
         chooseContestType(msg['types']);
      }).fail(reportError);
   }).fail(reportError);
};

function chooseContestType(types) {
   var contestTypeSelect = document.createElement('select');
   var saveButton = document.createElement('button');
   ([''].concat(types)).forEach(function(contestType) {
      // alert(contestType);
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
               contestType = typeChoice;
               enterContestName();
            }).fail(reportError);
         };
      };
   };
}

function enterContestName() {
   var saveButton = document.getElementById('contestNameSaveButton');
   var nameBox = document.getElementById('contestNameBox'); // 'Box' might sound like it's a div -- rename?
   contestNameContainer.style.display = 'block';
   nameBox.focus();
   saveButton.onclick = function() {
      if(nameBox.value != '') {
         // TODO: Send the name to backend
         contestNameContainer.innerHTML = 'Contest name: <strong>' + nameBox.value + '</strong>';
         contestNameContainer.classList.add('complete');
         uploadBallotManifest();
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
         success: function(ballotM) {
            console.log(ballotM);
            ballotManifestUploadContainer.innerHTML = '(Ballot Manifest Added)';
            ballotManifestUploadContainer.classList.add('complete');
            ballotManifest = ballotM;

            ballotNumToLocation = function(ballotNum) {
               var n, manifest, finished;
               n = ballotNum;
               manifest = ballotManifest.slice(); // copy-by-value so we can '.shift()'
               finished = false;
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

            switch (contestType) {
               case 'ballot_polling':
                  enterSeed();
                  break;
               // TODO: there are 2 different kinds of ballot comparison:
               case 'ballot_comparison':
                  uploadCVR();
                  break;
               default:
                  asodfaslfkj();
                  reportError('Unrecognized contest type: ' + contestType);
            }
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
      // ballotNumbers = []; // '<ol><li>23456</li></ol>';
      // TODO: careful with malicious/surprising input!:
      seed = seedTextBox.value;

      // console.log(seedTextBox);
      // console.log(seedTextBox.value);

      $.ajax({
         url: '/set-seed',
         data: JSON.stringify({'seed': seed}),
         method: 'POST',
         contentType: 'application/json'
      })
      .done(function(msg){
// This was for the demo:
/*
         for (i=0;i<10;i++) {
            ballotNumbers.push( Math.round(Math.random() * 1e6 ))
         };
*/

         ballotsToInspect = msg['ballot_ids'];

         ballotOl = buildOrderedList(ballotsToInspect);

         seedContainer.innerHTML = 'Seed: <strong>'+seed+'</strong>';
         seedContainer.classList.add('complete');
         ballotListDiv.style.display = 'block';
         
         ballotListDiv.appendChild(document.createTextNode('Ballot order:'));
         ballotListDiv.appendChild(ballotOl); // innerHTML = ballotList;
         
         ballotListDiv.appendChild(document.createTextNode('Sorted order:'));
         // '.slice' is so we can have a non-destructive sort:
         ballotListDiv.appendChild(buildOrderedList(ballotsToInspect.slice().sort(function (a, b) {  return a - b;  }))); // numeric sort

         var pullSheetText = document.createTextNode('Ballot Pull Sheet...');
         var a = document.createElement('a');
         a.href = '/ballot-pull-sheet.txt';
         a.target = '_blank';
         a.appendChild(pullSheetText);
         ballotListDiv.appendChild(a);

         // Now we can start inputting interpretations:
         make_new_ballot();


      })
      // TODO: big red error box here:
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



// TODO: better name because there's also 'new_ballot':

function make_new_ballot() {
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
         console.log(msg);
         finalResultContainer.innerHTML = 'Audit complete! Status: <strong>'+msg['status']+'</strong> ('+msg.progress+')';
         finalResultContainer.style.display = 'block';
      }).fail(reportError);
   } else {
      var ballot_entries = document.getElementById('ballot_entries');
      var ballot_id = ballotIdsLeft[0];
      ballot_entries.appendChild(new_ballot(ballot_id));
   }
}

function new_ballot(ballot_id) {
   var ballot, numberLabel, innerForm, ballotNumber;
   ballot = document.createElement('div');
   numberLabel = document.createElement('div');
   innerForm = new_inner_form(ballot_id);

   ballot.classList.add('ballot', 'inProgress', 'container');

   numberLabel.classList.add('numberLabel', 'inProgress');
   numberLabel.innerText = 'Ballot # '+highestBallot+', ID: '+ballot_id+', Location: '+ballotNumToLocation(ballot_id); // TODO: 'innerText' may not be cross-browser
   highestBallot += 1;

   ballot.appendChild(numberLabel);
   ballot.appendChild(innerForm);

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
   return ballot;
};

function new_inner_form(ballot_id) {

   var innerForm, saveButton;
   innerForm = document.createElement('div');
   saveButton = document.createElement('button');
   saveButton.innerHTML = 'Save';

 
   innerForm.classList.add('innerForm');

   contests.forEach(function(contest) {
      var contestBox = new_race_checkbox(ballot_id, contest.id, contest.title, contest.candidates);
      innerForm.appendChild(contestBox);
   });

   innerForm.appendChild(saveButton);

   saveButton.onclick = function(event) {
      var that = this;
      var dat = {ballot_id: ballot_id, contests: {}};
      contests.forEach(function(contest) {
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
         make_new_ballot(); // TODO: don't do this if you're clicking to save a second time and we already have an unfinished one
         // window.event.stopPropagation();
         event.stopPropagation();
      })
      .fail(reportError);
   }

   return innerForm;
};

function new_race_checkbox(ballot_id, race_id, race_title, race_choices) {
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
