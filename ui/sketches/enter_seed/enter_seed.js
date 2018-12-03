window.onload = function() {
   var saveButton, seedContainer, seedTextBox, ballotListDiv;
   saveButton = document.getElementById('seedSaveButton');
   seedContainer = document.getElementById('seedContainer');
   seedTextBox = document.getElementById('seedTextBox');
   ballotListDiv = document.getElementById('listOfBallotsToPull');
   

   saveButton.onclick = function() {
      var ballotNumbers, ballotOl;
      ballotNumbers = []; // '<ol><li>23456</li></ol>';

      // TODO: remove for loop:
      // and, obviously, not random:
      for (i=0;i<10;i++) {
         ballotNumbers.push( Math.round(Math.random() * 1e6 ))
      };

      ballotOl = buildOrderedList(ballotNumbers);

      // careful with malicious/surprising input!:
      seedContainer.innerHTML = 'SEED: '+seedTextBox.value;
      seedContainer.classList.add('complete');
      ballotListDiv.style.display = 'block';
      
      ballotListDiv.appendChild(document.createTextNode('Ballot order:'));
      ballotListDiv.appendChild(ballotOl); // innerHTML = ballotList;
      
      ballotListDiv.appendChild(document.createTextNode('Sorted order:'));
      ballotListDiv.appendChild(buildOrderedList(ballotNumbers.sort(function (a, b) {  return a - b;  }))); // numeric sort
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
