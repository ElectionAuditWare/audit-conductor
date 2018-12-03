// A warning to the reader (and writer!): we'll need to change at least a few
// ways of doing things to run a real audit. This is, as it's named, a sketch:

// A couple security examples:
//   - Don't use 'innerHTML'
//   - Be really meticulous about event propagation (e.g. for onclick handlers)


var highestBallot = 1; // global mutable state?!
var completedBallots = [];

window.onload = function() {
   make_new_ballot();
};

// TODO: better name because there's also 'new_ballot':

function make_new_ballot() {
   var ballot_entries = document.getElementById('ballot_entries');
   ballot_entries.appendChild(new_ballot(Math.round(Math.random()*1e6))); // '115389'));
}

function new_ballot(ballot_id) {
   var ballot, numberLabel, innerForm, ballotNumber;
   ballot = document.createElement('div');
   numberLabel = document.createElement('div');
   innerForm = new_inner_form(ballot_id);

   ballot.classList.add('ballot', 'inProgress', 'container');

   numberLabel.classList.add('numberLabel', 'inProgress');
   numberLabel.innerText = 'Ballot # '+highestBallot+', ID: ' + ballot_id; // 'innerText' may not be cross-browser
   highestBallot += 1;

   ballot.appendChild(numberLabel);
   ballot.appendChild(innerForm);

   ballot.onclick = function(event) {
      console.log('one', ballot, ballot_id);
      if (innerForm.style.display === 'none') {
         innerForm.style.display = 'block';
      } else if (completedBallots.includes(ballot_id)) {
         innerForm.style.display = 'none';
      }
      // window.event.stopPropagation();
      event.stopPropagation(); // all good?
   };
   return ballot;
};

function new_inner_form(ballot_id) {

   var innerForm, saveButton;
   innerForm = document.createElement('div');
   saveButton = document.createElement('button');
   saveButton.innerHTML = 'SAVE';

 
   innerForm.classList.add('innerForm');
   innerForm.appendChild(new_race_checkbox('congress_district_1','Representative in Congress District 1', ['David N. Cicilline', 'Christopher F. Young']));
   innerForm.appendChild(new_race_checkbox('assembly_19', 'Senator in General Assembly District 19', ['Alex D. Marszalkowski', 'David M. Chenevert']));
   innerForm.appendChild(new_race_checkbox('council_at_large', 'Town Council At-Large Cumberland', ['Thomas Kane', 'Peter J. Bradley', 'Charles D. Wilk']));
   innerForm.appendChild(saveButton);
   
   saveButton.onclick = function(event) {
      console.log('two');
      this.parentNode.parentNode.classList.replace('inProgress','complete');
      innerForm.style.display = 'none';
      make_new_ballot(); // TODO: don't do this if you're clicking to save a second time and we already have an unfinished one
      completedBallots.push(ballot_id);
      // window.event.stopPropagation();
      event.stopPropagation();
   }

   return innerForm;
};

function new_race_checkbox(race_id, race_label, race_choices) {
   var div, ul;
   div = document.createElement('div');
   div.innerText = race_label;
   div.classList.add('raceDiv');

   ul = document.createElement('ul');

   race_choices.concat(['No selection']).forEach(function(choice,i) {
      var checkbox,label,li;
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'name';
      checkbox.id = race_label+i; // careful! everything needs to be unique including when we append numbers
      checkbox.classList.add('choiceCheckbox');

      label = document.createElement('label');
      label.innerHTML = choice; // again, careful!
      label.setAttribute('for', checkbox.id);
      label.classList.add('choiceCheckboxLabel');

      li = document.createElement('li');

      li.appendChild(checkbox);
      li.appendChild(label);
      div.appendChild(li);
   });
   return div;
}

