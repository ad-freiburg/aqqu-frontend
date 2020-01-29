// Copyright 2016-2020, University of Freiburg
// Author: Natalie Prange <prangen@informatik.uni-freiburg.de>


// ---------------------- QAC related variables -------------------------------
var basePath = window.location.pathname.replace(/\/$/, "") + "/";

var URL_PREFIX_QAC = basePath + "qac?q=";
var COMPLETION_SELECTED_COLOR = "#C7D3DF";

var selectedButton = 0;
var lastResultLen = 0;
var lastMousePositionX = 0;
var lastMousePositionY = 0;
var maxTimestamp = 0;

// Regexes
var inputEntityRegex = /<span class="entity"[^>]*>([^<]*?)<\/span>/g

// Mouseover variables
var URL_PREFIX_TOOLTIP = basePath + "tooltip?qid=";

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


/* Set the text of the input field and set the focus to the
 * input field on completion prediction button click
 */
function handleCompletionButtonClick(buttonId) {
  // data-original is needed since entities in the compleion buttons show the
  // Wikipedia page title
  var original = $('#'+ buttonId).data("original");
  var markedHtml = putTextIntoSpansInput(original);
  $('#question').html(markedHtml);

  // Store entity QIDs in the hidden qids input field
  var qids = $('#'+ buttonId).data("qids");
  $('#qids').val(qids);

  // Store entity names as data of the input field
  var entities = getEntityNames(markedHtml);
  $('#question').data("entities", entities);

  // set focus to the end of the input within the input field.
  $('#question').focus();

  // Update cursor position
  var component = $('#question')[0];
  var data = getCaretData(component);
  setCaretPosition(data);
  var question = $("#question").html();
}


/* Get strings within entity spans */
function getEntityNames(text) {
  var matches = text.matchAll(inputEntityRegex);
  var entities = [];
  for (const match of matches) {
    entities.push(match[1]);
  }
  return entities;
}


/* Get an array of all spans in the given text */
function getSpansAsArray(text) {
  // Get end index of each span
  var regex = /<\/span>/gi;
  var result;
  var indices = [];
  while ( (result = regex.exec(text)) ) {
    var index = result.index + "</span>".length;
    indices.push(index);
  }
  // Get array of span strings
  var spans = [];
  var startIndex = 0;
  for (var i = 0; i < indices.length; i++) {
    var currentSpan = text.slice(startIndex, indices[i]);
    spans.push(currentSpan);
    startIndex = indices[i];
  }
  return spans;
}


/* On user input check if entity spans were touched. If so, remove entity spans
where the entity name does not match the original entity name anymore */
function handleInput() {
  var text = $('#question').html();
  var entities = $('#question').data("entities");
  var newEntities = [];
  var spans = getSpansAsArray(text);
  if (entities) {
    var currEntities = getEntityNames(text);
    var entityIndex = 0;
    var entityMismatch = false;
    var newSpans = [];
    for (var i = 0; i < spans.length; i++) {
      var currSpan = spans[i];
      var match = currSpan.match(inputEntityRegex);
      if (match != null) {
        if (currEntities[entityIndex] != entities[entityIndex]) {
          // Transform entity span where the name does not match the original
          // entity name into normal word span
          currSpan = currSpan.replace(/<span class="entity"[^>]*>/, '<span>');
          entityMismatch = true;
        } else {
          newEntities.push(entities[entityIndex]);
        }
        entityIndex++;
      }
      newSpans.push(currSpan);
      if (entityIndex >= entities.length) break;
    }

    if (entityMismatch) {
      text = newSpans.join("");
      // Remove empty normal-word-spans
      text = text.replace("<span></span>", "");
      // Merge adjacent normal-word-spans
      text = text.replace(/(<span>[^<]*?)<\/span><span>/, "$1");
      // Reset the tooltip
      resetTooltip();
    }
  }

  // Update input field text
  text = text.replace("<br>", "");
  $('#question').html(text);
  $('#question').data("entities", newEntities);

  // Update cursor position
  var component = $('#question')[0];
  var data = getCaretData(component);
  setCaretPosition(data);
}


function handleKeyPress(event) {
  switch (event.which) {
    case 13:
      if (! event.ctrlKey) {
        // Enter: Choose selected completion and get new completions
        enterPressed();
        return;
      }
      return;
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

  // Get the current question prefix with entities in the format [<QID>]
  var question = $("#question").html();
  console.log("question: '"+ question + "'");
  question = question.replace(/<br>/g, "");
  question = removeHtmlInputField(question);
  console.log("question wo entities: '"+ question + "'");
  var qids = $("#qids").val();
  if (qids) {
    question = getQidQuestion(question, qids);
  }

  // Globally replace whitespaces with %20 otherwise trailing whitespaces are stripped
  question = encodeURI(question);

  // Get completions for the current prefix from the server
  var url = URL_PREFIX_QAC + question + "&t=" + Date.now();
  $.getJSON(url, function(jsonObj) {
    // Bail early if the result is empty
    if (jsonObj.length == 0) return;

    var results = jsonObj["results"];
    var timestamp = jsonObj["timestamp"];

    // Check if a more recent request has been received already
    if (timestamp < maxTimestamp) {
      return;
    }
    maxTimestamp = timestamp;

    // Remove old completion buttons
    removeCompletionButtons(results.length);

    // Add the new buttons displaying the results sent by the server.
    for (i=0; i < results.length; i++) {
      var completion = results[i]["completion"];
      var wiki_completion = results[i]["wikified_completion"];
      var alias = results[i]["matched_alias"];
      var qids = results[i]["qids"];
      var buttonHtml = addAlias(wiki_completion, alias);
      buttonHtml = putTextIntoSpans(buttonHtml);
      $("<button/>", {
        class: "comp_buttons",
        id: "button" + i,
        onClick: "handleCompletionButtonClick(this.id)",
        onmousemove: "handleMouseOver(this.id, event)",
        html: buttonHtml,
      }).appendTo("#completions");

      $("#button"+i).data("qids", qids);
      $("#button"+i).data("original", completion);
      $("#button"+i).css("background-color", "white");
    }

    // Set the color of the first button to "selected"
    $("#button0").css("background-color", COMPLETION_SELECTED_COLOR);
  })
}


/* Replace entity mentions in the question by [<QID>]*/
function getQidQuestion(question, qids) {
  var qidsArray = qids.split(",");
  matches = question.match(/\[.*?\]/g);
  if (matches) {
    for (i=0; i < matches.length; i++) {
      // For now assume the user does not enter brackets []
      question = question.replace(matches[i], "[" + qidsArray[i] + "]");
    }
  }
  return question
}


/* If the completion was made for an alias, append alias */
function addAlias(completion, alias) {
  if (alias != "") {
    completion = completion.replace(/\[(.*?)\] $/, ' \[$1 <span class="alias">\(' + alias + '\)</span>\] ');
  }
  return completion
}


/* Mark entities using spans instead of brackets */
function putTextIntoSpans(text) {
  text = text.replace(/(\]|^)([^\[\]]*?)(\[)/g, '$1<span>$2</span>$3');
  text = text.replace(/(\]|^)([^\[\]]*?)($)/g, '$1<span>$2</span>');
  text = text.replace(/\[(.*?)\]/g, '<span class="entity">$1</span>');
  return text
}


/* Mark entities using spans instead of brackets */
function putTextIntoSpansInput(text) {
  text = text.replace(/(\]|^)([^\[\]]*?)(\[)/g, '$1<span>$2</span>$3');
  text = text.replace(/(\]|^)([^\[\]]*?)($)/g, '$1<span>$2</span>');
  var regex = /\[(.*?)\]/;
  var match = regex.exec(text);
  var i = 0;
  while (match != null) {
      // For now assume the user does not enter brackets []
      var replStr = '<span class="entity" onmouseleave="hideTooltip()" onmouseenter="handleEntityMouseover('
                    + i + ', event)">' + match[1] + '</span>'
      text = text.replace(match[0], replStr);
      match = regex.exec(text);
      i++;
  }
  return text
}


/* Remove html tags in the input field text and replace entity spans by [] */
function removeHtmlInputField(text) {
  text = text.replace(/<span>([^<]*?)<\/span>/g, '$1');
  text = text.replace(inputEntityRegex, '\[$1\]');
  return text;
}


/* Remove completion buttons for a previous question prefix */
function removeCompletionButtons(newResultLength) {
  for (i=0; i < lastResultLen; i++) {
    $('#button' + i).remove();
  }
  lastResultLen = newResultLength;
}


/* Show entity information on mouseover */
function handleEntityMouseover(index, event) {
  var qid = $("#qids").val().split(",")[index];
  var url = URL_PREFIX_TOOLTIP + qid;
  $.getJSON(url, function(jsonObj) {
    // Bail early if the result is empty
    if (jsonObj.length == 0) return;

    // Get necessary information for tooltip from json response
    var imageUrl = jsonObj["image"];
    var abstract = jsonObj["abstract"];
    if (imageUrl == "" && abstract == "") {
      abstract = "No information found."
    }

    // Get information about position of the tooltip
    var tooltipNode = $("#tooltip");
    var x = event.pageX;
    var height = tooltipNode.height();
    var width = tooltipNode.width();
    var topInput = $("#question").offset().top;
    var maxHeight = topInput - 20;
    if (height > maxHeight) {
      tooltipNode.css("height", maxHeight + "px");
    }

    // Set content of tooltip
    tooltipNode.find(".abstract").text(abstract);
    tooltipNode.find(".img").attr("src", imageUrl);

    // Position tooltip
    tooltipNode.css("top", topInput - height - 10 + 'px');
    tooltipNode.css("left", (x - width/2 - 5) + 'px');
    tooltipNode.css("max-height", maxHeight + 'px');

    // Show tooltip on mouseover
    tooltipNode.css("visibility", 'visible');
  });
}


/* Hide the tooltip when the mouse is not hovering over the entity anymore */
function hideTooltip() {
  console.log("Remove Tooltip called");
  var tooltipNode = $("#tooltip");
  tooltipNode.css("visibility", 'hidden');
}


/* Reset the tooltip by emptying its fields e.g. when the entity was removed */
function resetTooltip() {
  var tooltipNode = $("#tooltip");
  tooltipNode.find(".abstract").text("");
  tooltipNode.find(".img").attr("src", "");
  tooltipNode.css("visibility", 'hidden');
}


// ---------------------- AQQU related functions ------------------------------

/* Display the results returned by the Aqqu API */
function displayAqquResults() {
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
    $("#ask").prop('disabled', false);
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


/* Copy the question from the contenteditable div to a hidden input field so it
can be submitted with the form */
function copyQuestionToInput() {
  var question = $("#question").html();
  var entityMarkedQuestion = removeHtmlInputField(question);
  console.log("Question sent to Aqqu: " + entityMarkedQuestion);
  $("#q").val(entityMarkedQuestion);
}

// ---------------------- General ---------------------------------------------

/* Get all nodes for the given element */
function getAllNodes(el){
  var n;
  var a = [];
  var walk = document.createTreeWalker(el, NodeFilter.SHOW_ALL, null, false);
  while(n=walk.nextNode()) {
    a.push(n);
  }
  return a;
}


/* Get last node in the element and the position of the cursor if it was to
be set to the end of the text */
function getCaretData(el){
  var node;
  var nodes = getAllNodes(el);
  var position = 0;
  if (nodes.length > 0) {
    node = nodes[nodes.length - 1];
    // If node is empty (e.g. <span></span>) append it still and set pos to 0
    if (nodes[nodes.length - 1].nodeValue != null) {
      position = nodes[nodes.length - 1].nodeValue.length;
    } else {
      position = 0;
    }
  }
  return { node: node, position: position };
}


/* Set caret to the given position in the given node */
function setCaretPosition(data){
  var sel = window.getSelection();
  var range = document.createRange();
  range.setStart(data.node, data.position);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}


$(document).ready(function(){
  // If a query exists already in the input field, put it into the right format
  var text = $("#question").text();
  text = putTextIntoSpansInput(text);
  $("#question").html(text);

  // Set hidden input qids to data qids. This is needed as for some unknown
  // reason while the data value gets updated by the server, the input value
  // does not.
  var qidsdata = $("#qids").data("qids");
  $("#qids").val(qidsdata);

  // Focus input field when page is loaded
  $("#question").focus();

  $("#question").on({
    'input': handleInput,
  });

  // Otherwise, if e.g. the connection to the Aqqu-Api is lost the button could
  // remain disabled even on reload
  $("#ask").prop('disabled', false);

  // Display Aqqu results if the result div exists and is completely loaded
  var resultDiv = $(".result");
  resultDiv.ready(function() {
    if ($.contains(document.body, resultDiv[0])){
      displayAqquResults();
    }
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
  $("#questionForm").keydown(function (event) {
    if(event.keyCode == 13) {
      if (!event.ctrlKey) {
        event.preventDefault();
      } else {
        copyQuestionToInput();
        $("#questionForm").submit();
      }
    }
  });

  // Disable default behavior on arrow up (cursor jumps to start position)
  $(document).on("keydown keyup", "#question", function(event) { 
    if(event.which == 38 || event.which == 40){
        event.preventDefault();
    }
  });
});
