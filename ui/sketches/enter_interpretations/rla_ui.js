// TODO:
//   - Don't use 'innerHTML'

// Contest IDs cannot contain "strange" characters
//   (Either define this more carefully or just limit to "a-z0-9_-")

// For now we hardcode these to get the code in a clean runnable state:
var contests = [
   {id: 'congress_district_1',
    title: 'Representative in Congress District 1',
    candidates: ['David N. Cicilline', 'Christopher F. Young']
   },
   {id: 'assembly_19',
    title: 'Senator in General Assembly District 19',
    candidates: ['Alex D. Marszalkowski', 'David M. Chenevert']
   },
   {id: 'council_at_large',
    title: 'Town Council At-Large Cumberland',
    candidates: ['Thomas Kane', 'Peter J. Bradley', 'Charles D. Wilk']
   }
   ];




var highestBallot = 1; // global mutable state?!
var completedBallots = [];

window.onload = function() {
   make_new_ballot();
};

// TODO: better name because there's also 'new_ballot':

function make_new_ballot() {
   var ballot_entries = document.getElementById('ballot_entries');
   ballot_entries.appendChild(new_ballot(Math.round(Math.random()*1e6)));
}

function new_ballot(ballot_id) {
   var ballot, numberLabel, innerForm, ballotNumber;
   ballot = document.createElement('div');
   numberLabel = document.createElement('div');
   innerForm = new_inner_form(ballot_id);

   ballot.classList.add('ballot', 'inProgress', 'container');

   numberLabel.classList.add('numberLabel', 'inProgress');
   numberLabel.innerText = 'Ballot # '+highestBallot+', ID: '+ballot_id; // TODO: 'innerText' may not be cross-browser
   highestBallot += 1;

   ballot.appendChild(numberLabel);
   ballot.appendChild(innerForm);

   numberLabel.onclick = function(event) {
      if (innerForm.style.display === 'none') {
         innerForm.style.display = 'block';
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
   saveButton.innerHTML = 'SAVE';

 
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
      console.log(dat);
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
         that.parentNode.parentNode.classList.replace('inProgress','complete');
         innerForm.style.display = 'none';
         make_new_ballot(); // TODO: don't do this if you're clicking to save a second time and we already have an unfinished one
         completedBallots.push(ballot_id);
         // window.event.stopPropagation();
         event.stopPropagation();
      })
      // TODO: big red error box here:
      .fail(function(e) {
         alert('AJAX failure!: '+JSON.stringify(e));
      });
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

   race_choices.concat(['No selection']).forEach(function(choice,i) {
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
