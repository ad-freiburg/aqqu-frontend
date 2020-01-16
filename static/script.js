// Copyright 2016-2020, University of Freiburg
// Author: Natalie Prange <prangen@informatik.uni-freiburg.de>


// ---------------------- QAC related variables -------------------------------
var host = window.location.hostname;
var port = window.location.port;
var basePath = window.location.pathname.replace(/\/$/, "") + "/";

var URL_PREFIX_QAC = basePath + "qac?q=";
var COMPLETION_SELECTED_COLOR = "#C7D3DF";

var selectedButton = 0;
var lastResultLen = 0;
var lastMousePositionX = 0;
var lastMousePositionY = 0;

// ---------------------- Aqqu related variables ------------------------------
var MAX_RESULTS = 10;
var URL_PREFIX_AQQU = basePath;

var currIndex = -1;
var numAnswers = 0;
var currAnswers = [];

// ---------------------- QAC related functions -------------------------------

/* Handle navigation of the completion predictions using arrow keys.
 * Direction is an integer and either 1 (up) or -1 (down).
 */
function navigateCompletions(direction) {
  // Set the color of the previously selected button back to white.
  var buttonClass = $(".comp_buttons");  
  var priorButtonId = buttonClass.children().eq(selectedButton).attr('id');
  var priorButton = $('#'+ priorButtonId);
  priorButton.css("background-color", "white");
  
  // Get the number of buttons (not buttonClass.children().length since table
  // and tbody is also included in children)
  var numButtons = buttonClass.find("button").length

  // Set the color of the newly selected button to the hover-color.
  selectedButton = (selectedButton + direction) % numButtons;
  if (selectedButton == -2) {
    selectedButton = -1;
  }
  if (selectedButton < 0) {
    selectedButton += numButtons;
  }
  var buttonId = buttonClass.children().eq(selectedButton).attr('id');
  var button = $('#'+ buttonId);
  button.css("background-color", COMPLETION_SELECTED_COLOR);
}


function enterPressed() {
  buttonId = $(".comp_buttons").children().eq(selectedButton).attr('id');
  handleCompletionButtonClick(buttonId);
}


/* Change the color of a button on mouseover */
function handleMouseOver(buttonId, event) {
  // Only do something if the user moved the mouse since the last call
  if (event.pageX == lastMousePositionX && event.pageY == lastMousePositionY) {
    return;
  }

  // Set the color of the newly selected button to the hover-color.
  var id = buttonId.slice(-1);
  var newSelectedButton = parseInt(id);
  var button = $('#'+ buttonId);
  button.css("background-color", COMPLETION_SELECTED_COLOR);

  // Set the color of the last selected button back to white.
  if (selectedButton != newSelectedButton) {
    var priorButton = $('#button'+ selectedButton);
    priorButton.css("background-color", "white");
    selectedButton = newSelectedButton;
  }
  if (newSelectedButton != 0) {
    var zeroButton = $('#button0');
    zeroButton.css("background-color", "white");
  }
}


/* Set the text of the input field on and set the focus to the
 * input field on completion prediction button click
 */
function handleCompletionButtonClick(buttonId) {
  var v = $('#'+ buttonId).html();
  v = v.replace(/ <i>\((.*?)\)<\/i>/g, "")
  $('#question').val(v);
  // set focus to the end of the input within the input field.
  $('#question').focus();
}


function handleKeyPress(event) {
  switch (event.which) {
    case 13:
      if (! event.ctrlKey) {
        // Enter: Choose selected completion and get new completions
        enterPressed();
        return;
      }
      return
    case 38:
      // Up arrow: navigate to upper completion
      navigateCompletions(-1);
      return;
    case 40:
      // Down arrow: navigate to lower completion
      navigateCompletions(1);
      return;
    default:
      // If the user entered a new character
      getCompletions();
  }
}


/* Get completions for the current question prefix in the input field */
function getCompletions() {
  // Reset the selected button to 0 so that the selection starts again at the top
  selectedButton = 0;

  // Get the current query prefix
  var query = $("#question").val();

  // Globally replace whitespaces with %20 otherwise trailing whitespaces are stripped
  query = encodeURI(query);
  console.log("Query: "+ query);

  // Get completions for the current prefix from the server
  var url = URL_PREFIX_QAC + query;
  $.get(url, function(result) {
    result = jQuery.parseJSON(result);

    // Remove old completion buttons
    removeCompletionButtons(result.length);

    // Add the new buttons displaying the results sent by the server.
    for (i=0; i < result.length; i++) {
      var currCompletion = result[i].replace(/ \(alias=(.*?)\)/g, " <i>\($1\)</i>");
      $("<button/>", {
        class: "comp_buttons",
        id: "button" + i,
        onClick: "handleCompletionButtonClick(this.id)",
        onmousemove: "handleMouseOver(this.id, event)",
        html: currCompletion
      }).appendTo("#completions");

      $("#button"+i).css("background-color", "white");
    }

    // Set the color of the first button to "selected"
    $("#button0").css("background-color", COMPLETION_SELECTED_COLOR);
  })
}


function removeCompletionButtons(newResultLength) {
  // Remove the old buttons
  for (i=0; i < lastResultLen; i++) {
    $('#button' + i).remove();
  }
  lastResultLen = newResultLength;
}


// ---------------------- AQQU related functions ------------------------------

/* Display the results returned by the Aqqu API */
function displayAqquResults() {
  console.log("displayAqquResults() called");
  var result = $(".answers").attr("data")
  if (result) {
    numAnswers = jQuery.parseJSON(result).length;

    if (moveIndex(0) == true) {
      $("#caption").css("display", "block");
      $("#interpretation").css("display", "block");
      $(".navigation").css("display", "inline-block");
      updateNavigationButtons();
      showCurrentResult(true);
    }

    // Re-enable the submit button
    $("#submit").prop('disabled', false);
  }
}


/* Move the current index to the given index if in range */
function moveIndex(index) {
  if (index < 0 || index >= numAnswers) {
    // Return if the index is out of range
    return false;
  } else {
    // Update the current index
    currIndex = index;
    return true;
  }
}


/* Show the answers for the current result index */
function showCurrentResult(firstResult) {
  // If this is not the first result shown for the current question,
  // clean the previous result first
  if (firstResult == false) {
    // Hide show_more / show_less buttons
    $('body').removeClass("more_results");
    $('body').removeClass("less_results");
    // Hide "no answer for this interpretation"-paragraph
    $("#no_answer").css("display", "none");
    // Remove previous answer paragraphs
    $(".answer_fields").remove();
  }
  // Update caption
  showCaption(currIndex);
  // Update the interpretation
  showInterpretation(currIndex);
  // Update the actual answer (answer fields)
  showAnswers(currIndex);
}


function showCaption(index) {
  $("#caption").text("Candidate " + (index + 1) + " of " + numAnswers);
}


/* Show the answer fields for the current index */
function showAnswers(index) {
  // Get data from html div
  var result = $(".answers").attr("data")
  currAnswers = jQuery.parseJSON(result)[index];

  // Show an info message if there are no answers for this interpretation
  if (currAnswers.length == 0) {
    $("#no_answer").css("display","block");
  }

  for (j = 0; j < currAnswers.length; j++) {
    // Only show up to MAX_RESULTS results per interpretation
    if (j >= MAX_RESULTS ) {
      $('body').addClass("more_results");
      break;
    }
    
    // Add an answer answer field to the web page
    $("<p/>", {
      class: "answer_fields",
      id: "a_"+index+"_"+j,
      text: currAnswers[j]
    }).insertBefore("#show_more");
  }
}


/* Show the interpretation for the current index */
function showInterpretation(index) {
  // Get data from html p
  var result = $("#interpretation").attr("data");
  var interpretations = jQuery.parseJSON(result);
  var currInterpretation = interpretations[index];

  $('#interpretation').text(currInterpretation);
}


/* Show more results (handle click on show-more-button) */
function showMoreResults() {
  // Hide the "show_more"- button
  $("body").removeClass("more_results");

  for (j=MAX_RESULTS; j<currAnswers.length; j++) {
    // Add an answer field to the web page
    $("<p class='answer_fields' id='a_" + currIndex + "_" + j + "'>"
      + currAnswers[j] + "</p>").insertBefore("#show_more");
  }

  // Show the button for showing less results
  $("body").addClass("less_results")
}


/* Show less results (handle click on show-less-button) */
function showLessResults() {
  // Hide the "show_less"- button
  $("body").removeClass("less_results")

  for (j=MAX_RESULTS; j<currAnswers.length; j++) {
    // Remove answer field
    $("#a_"+currIndex+"_"+j).remove();
  }

  // Show the "show_more"- button
  $("body").addClass("more_results");
}


/* Navigate between different results */ 
function navigateResults(button) {
  var success = true;
  switch(button) {
    case 0:
      // Move to first answer
      success = moveIndex(0);
      break;
    case 1:
      // Move to previous answer
      success = moveIndex(currIndex-1);
      break;
    case 2:
      // Move to next answer
      success = moveIndex(currIndex+1);
      break;
    case 3:
      // Move to last answer
      success = moveIndex(numAnswers - 1);
      break;
  }
  if (success == true) {
    updateNavigationButtons();
    showCurrentResult(false);
  }
}


/* Update the navigation buttons (enabled / disabled) */
function updateNavigationButtons() {
  if (currIndex - 1 < 0) {
    $('#first').prop('disabled', true);
    $('#previous').prop('disabled', true);
  } else {
    $('#first').prop('disabled', false);
    $('#previous').prop('disabled', false);
  }
  if (currIndex + 1 >= numAnswers) {
    $('#last').prop('disabled', true);
    $('#next').prop('disabled', true);
  } else {
    $('#last').prop('disabled', false);
    $('#next').prop('disabled', false);
  }
}

// ---------------------- General ---------------------------------------------

/* Helper function to place the cursor of an input field at its end. See
 * https://css-tricks.com/snippets/jquery/move-cursor-to-end-of-textarea-or-input
 */
jQuery.fn.putCursorAtEnd = function() {
  return this.each(function() {
    // Cache references
    var $el = $(this),
        el = this;

    // Only focus if input isn't already
    if (!$el.is(":focus")) {
     $el.focus();
    }

    // If this function exists... (IE 9+)
    if (el.setSelectionRange) {
      // Double the length because Opera is inconsistent about whether a carriage return is one character or two.
      var len = $el.val().length * 2;
      
      // Timeout seems to be required for Blink
      setTimeout(function() {
        el.setSelectionRange(len, len);
      }, 1);
    } else {
      // As a fallback, replace the contents with itself
      // Doesn't work in Chrome, but Chrome supports setSelectionRange
      $el.val($el.val());
    }

    // Scroll to the bottom, in case we're in a tall textarea
    // (Necessary for Firefox and Chrome)
    this.scrollTop = 999999;
  });
}


$(document).ready(function(){
  // Focus input field when page is loaded
  $("#question").focus();

  // On focus place cursor at the end of the input field
  var questionInput = $("#question");
  questionInput.putCursorAtEnd().on("focus", function() {
      questionInput.putCursorAtEnd()
  });

  // Otherwise, if e.g. the connection to the Aqqu-Api is lost the button could
  // remain disabled even on reload
  $("#submit").prop('disabled', false);

  $('.result').ready(function() {
    displayAqquResults();
  });

  // Allow navigation of results with left & right arrow key (only when input
  // field does not have focus)
  $(document).keydown(function(e) {
    if (!$("#question").is(":focus")) {
      switch (e.keyCode) {
        case 37:
          // Left arrow: navigate to previous result
          navigateResults(1);
          return;
        case 39:
          // Right arrow: navigate to next result
          navigateResults(2);
          return;
      }
    }
  });

  // Enter should not submit the question to Aqqu via the form action.
  // Only Enter + Ctrl should.
  $(document).keydown(function (event) {
    if(event.keyCode == 13 && !event.ctrlKey) {
      event.preventDefault();
    }
  });

  // Disable default behavior on arrow up (cursor jumps to start position)
  $(document).on("keydown keyup", "#question", function(event) { 
    if(event.which == 38 || event.which == 40){
        event.preventDefault();
    }
  });
});

