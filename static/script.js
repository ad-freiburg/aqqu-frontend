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
var showCompletions = true;

// Regexes
var inputEntityRegex = /<span class="entity"[^>]*>([^<]*?)<\/span>/g
var inputEntityOriginalRegex = /<span class="entity"[^>]*data-original="(.*?)"[^>]*>[^<]*?<\/span>/g
var inputEntityQidRegex = /<span class="entity"[^>]*data-qid="(.*?)"[^>]*>[^<]*?<\/span>/g

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
  // Store entity QIDs in the hidden qids input field
  var qids = $('#'+ buttonId).data("qids");
  $("#qids").val(qids);

  // Retrieve entity Wikipedia urls
  var urls = $('#'+ buttonId).data("urls");

  // Retrieve entities from previous question
  var prevEntities = getEntityOriginals($("#question").html());

  // data-original is needed since entities in the compleion buttons show the
  // Wikipedia page title
  var original = $('#'+ buttonId).data("original");
  var markedHtml = putTextIntoSpansInput(original, qids, urls);
  $('#question').html(markedHtml);

  // If entities changed create new tooltips
  var entities = getEntityOriginals(markedHtml);
  if (prevEntities != entities) {
    for (qid of qids) {
      if (qid != "" && $("#tooltip_" + qid).length == 0) {
        createTooltip(qid);
      }
    }
  }

  // set focus to the end of the input within the input field.
  $('#question').focus();

  // Update cursor position
  placeCaretAtPosition($('#question')[0], -1);
  $('#question').scrollLeft(10000);

  // Submit question if last character is a question mark
  var questionText = $('#question').text();
  if (questionText.length > 0 && questionText.slice(-1) == "?") {
    onSubmitQuestion();
  }
}


/* Get original entity names from entity span data */
function getEntityOriginals(text) {
  var matches = text.matchAll(inputEntityOriginalRegex);
  var originals = [];
  for (const match of matches) {
    originals.push(match[1]);
  }
  return originals;
}


/* Get entity QIDs from entity span data */
function getEntityQids(text) {
  var matches = text.matchAll(inputEntityQidRegex);
  var qids = [];
  for (const match of matches) {
    qids.push(match[1]);
  }
  return qids;
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
  // If answers are currently shown - remove it
  $(".result").remove();
  var originalText = $('#question').html();
  var originalPos = getCaretCharacterOffsetWithin($('#question')[0]);

  // Merge nested spans
  var nestedSpanRegex = /<span[^<>]*>([^<>]*?)<span[^<>]*?>([^<>]*?)<\/span>/;
  var text = originalText.replace(nestedSpanRegex, "<span>$1$2<\/span>");

  // Remove entity spans of edited entities
  var spans = getSpansAsArray(text);
  var entityMismatch = false;
  var newSpans = [];
  for (var i = 0; i < spans.length; i++) {
    var matches = spans[i].matchAll(inputEntityRegex);
    for (const match of matches) {
      if (match[1] != getEntityOriginals(match[0])[0]) {
        // Transform entity span where the name does not match the original
        // entity name into normal word span
        spans[i] = spans[i].replace(/<span class="entity"[^>]*>/, '<span>');
        entityMismatch = true;
      }
    }
    newSpans.push(spans[i]);
  }

  if (entityMismatch) {
    text = newSpans.join("");
  }

  // Remove empty normal-word-spans unless it's the last span
  text = text.replace(/<span><\/span>([^$])/g, "$1");

  // Merge adjacent normal-word-spans recursively
  var newText = text;
  do {
    text = newText;
    newText = text.replace(/(<span>[^<]*?)<\/span><span>/g, "$1");
  } while (newText != text)

  // Remove automatically inserted line breaks
  text = text.replace("<br>", "");

  // Remove automatically inserted font color tags
  text = text.replace(/<font[^<>]*?>([^<>]*?)<\/font>/g, "$1");

  // Prevent Firefox weird-caret-position-bug when all spans are empty by
  // inserting an invisible character
  text = text.replace(/^(<span><\/span>)*$/, "<span>\u200c</span>");

  if (text != originalText) {
    // Update input field text
    $('#question').html(text);

    // Set caret to the correct position
    if (text == "<span>\u200c</span>" || $('#question').text().length == originalPos) {
      originalPos = -1;
    }
    placeCaretAtPosition($('#question')[0], originalPos);
  }

  // Remove tooltips for entities that were deleted
  var prevQids = $("#qids").val().split(",");
  var qids = getEntityQids(text);
  for (const qid of prevQids) {
    if (qid.length > 0 && !qids.includes(qid)) {
      removeTooltip(qid);
    }
  }
  // Update qids
  $("#qids").val(qids.join(""));

  // Submit question if last character is a question mark
  var questionText = $('#question').text();
  if (questionText.length > 0 && questionText.slice(-1) == "?") {
    onSubmitQuestion();
  }
}


function handleKeyPress(event) {
  if (!showCompletions) return;
  switch (event.which) {
    case 13:
      if (! event.ctrlKey) {
        // Enter: Choose selected completion and get new completions
        enterPressed();
        return;
      }
      return;
    case 17:
      // Ctrl: do nothing: prevent default to avoid call to getCompletions on
      // submit
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
  if (!showCompletions) return;
  // Reset the selected button to 0 so that the selection starts again at the top
  selectedButton = 0;

  // Get the current question prefix with entities in the format [<QID>]
  var question = $("#question").html();
  console.log("question: '"+ question + "'");
  var qids = getEntityQids(question);
  question = question.replace(/<br>/g, "");
  question = removeHtmlInputField(question);
  console.log("question wo entities: '"+ question + "'");
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
      var urls = results[i]["urls"];
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
      $("#button"+i).data("urls", urls);
      $("#button"+i).data("original", completion);
      $("#button"+i).css("background-color", "white");
    }

    // Set the color of the first button to "selected"
    $("#button0").css("background-color", COMPLETION_SELECTED_COLOR);
  })
}


/* Replace entity mentions in the question by [<QID>]*/
function getQidQuestion(question, qids) {
  matches = question.match(/\[.*?\]/g);
  if (matches) {
    for (i=0; i < matches.length; i++) {
      // For now assume the user does not enter brackets []
      question = question.replace(matches[i], "[" + qids[i] + "]");
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
function putTextIntoSpansInput(text, qids, urls) {
  text = text.replace(/(\]|^)([^\[\]]*?)(\[)/g, '$1<span>$2</span>$3');
  text = text.replace(/(\]|^)([^\[\]]*?)($)/g, '$1<span>$2</span>');
  // Prevent Firefox weird-caret-position-bug when all spans are empty by
  // inserting an invisible character
  text = text.replace(/^(<span><\/span>)$/, "<span>\u200c</span>");

  var regex = /\[(.*?)\]/;
  var match = regex.exec(text);
  var i = 0;
  while (match != null) {
    var qid = qids[i];
    var url = urls[i];
    // For now assume the user does not enter brackets []
    var replStr = '<span class="entity" id="entity_' + i + '" onmouseleave="'
                  + 'hideTooltip(this)" onmouseenter="showTooltip(this, event)"'
                  + ' data-qid="'+ qid + '" data-original="' + match[1] + '"';
    if (url) {
      replStr += ' onclick="window.open(\'' + url + '\')"';
    } else {
      replStr += ' style="cursor: default"';
    }
    replStr += '>' + match[1] + '</span>';
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
function showTooltip(el, event) {
  var qid = $(el).data("qid");
  var tooltipId = "tooltip_" + qid;
  var parentId = $(el).attr("id");
  positionTooltip(tooltipId, event.pageX, parentId);
  $("#" + tooltipId).css("display", "flex");
  $("#" + tooltipId).css("visibility", "visible");
}


/* Get abstract and image url for the given QID from server */
function createTooltip(qid) {
  var url = URL_PREFIX_TOOLTIP + qid;
  $.getJSON(url, function(jsonObj) {
    // Bail early if the result is empty
    if (jsonObj.length == 0) return;

    // Get necessary information for tooltip from json response
    var image = jsonObj["image"];
    var abstract = jsonObj["abstract"];
    createTooltipNode(qid, image, abstract, ".question");
  });
}


/* Create a tooltip div. Use QID as ID. One tooltip is sufficient per entity
even if the entity appears multiple times in the question. In that case the
tooltip only needs to be repositioned. */
function createTooltipNode(qid, image, abstract, parentId) {
  var tooltipId = "tooltip_" + qid;
  // Create div element
  $("<div/>", {
    class: "tooltip",
    id: tooltipId
  }).appendTo(parentId);
  // Create img element for thumbnail
  if (image.length > 0) image += "?width=400px"
  else image = "static/no_image.png"
  $("<img/>", {
    src: image
  }).appendTo("#" + tooltipId);
  // Create div element for abstract
  $("<div/>", {
    id: "abstract_" + qid,
    class: "abstract"
  }).appendTo("#" + tooltipId);
  // Create p element for abstract
  $("<p/>", {
    text: abstract
  }).appendTo("#abstract_" + qid);
  // Create p element for fadeout overflow
  $("<p/>", {
    class: "fadeout"
  }).appendTo("#abstract_" + qid);
  if (abstract == "") {
    var p = $("#" + tooltipId).find(".abstract");
    p.text("No information found");
    p.css("text-align", "center");
    $("#abstract_" + qid).css("margin", "auto");
    if (image == "") {
      $("#" + tooltipId).css("width", "auto");
      $("#" + tooltipId).find("img").css("min-width", "0");
      $("#" + tooltipId).find("img").css("width", "0");
    }
  }
}


/* Position the tooltip for the given QID above the input field at the current
mouse x value */
function positionTooltip(tooltipId, xPos, parentId) {
  // Get information about position of the tooltip
  var tooltipNode = $("#" + tooltipId);
  var height = tooltipNode.height();
  var width = tooltipNode.width();
  var topInput = $("#question").offset().top;
  var maxHeight = topInput - 20;
  if (height > maxHeight) {
    tooltipNode.css("height", maxHeight + "px");
    height = maxHeight;
  }

  // Position tooltip
  if (parentId.startsWith("answer")) {
    var topParent = $("#" + parentId).offset().top;
    tooltipNode.css("top", topParent - height - 10 + 'px');
  } else {
    tooltipNode.css("top", topInput - height - 10 + 'px');
  }
  tooltipNode.css("left", (xPos - width/2 - 5) + 'px');
  tooltipNode.css("max-height", maxHeight + 'px');
}

/* Remove tooltip for entity with the given QID */
function removeTooltip(qid) {
  $("#tooltip_" + qid).remove();
}


/* Hide the tooltip when the mouse is not hovering over the entity anymore */
function hideTooltip(el) {
  var qid = $(el).data("qid");
  var tooltipId = "tooltip_" + qid;
  var tooltipNode = $("#" + tooltipId);
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
    $(".answers").find(".tooltip").remove();
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
    
    // Add an answer field to the web page
    addAnswerField(currAnswers[j], index, j);

    // Create tooltip
    var mid = currAnswers[j]["mid"].replace(".", "_");
    var image = currAnswers[j]["image"];
    var abstract = currAnswers[j]["abstract"];
    if ($("#tooltip_" + mid).length == 0) {
      createTooltipNode(mid, image, abstract, ".answers");
    }
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
    addAnswerField(currAnswers[j], currIndex, j);

    // Create tooltip
    var mid = currAnswers[j]["mid"].replace(".", "_");
    var image = currAnswers[j]["image"];
    var abstract = currAnswers[j]["abstract"];
    if ($("#tooltip_" + mid).length == 0) {
      createTooltipNode(mid, image, abstract, ".answers");
    }
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
    $("#answer_"+currIndex+"_"+j).remove();
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


/* Add an answer field (link and paragraph) to the web page */
function addAnswerField(answer, candidateIndex, answerIndex) {
  // Only use link if url is not empty. Otherwise use paragraph
  var fieldId = "answer_" + candidateIndex + "_" + answerIndex;
  if (answer["url"]) {
    $("<a/>", {
      class: "answer_fields",
      id: fieldId,
      href: answer["url"],
      target: "_blank",
      rel: "noopener",
      text: answer["name"],
      onmouseenter: "showTooltip(this, event)",
      onmouseleave: "hideTooltip(this)"
    }).insertBefore("#show_more");
  } else {
    $("<p/>", {
      class: "answer_fields",
      id: fieldId,
      text: answer["name"],
      onmouseenter: "showTooltip(this, event)",
      onmouseleave: "hideTooltip(this)"
    }).insertBefore("#show_more");
  }
  $("#" + fieldId).data("qid", answer["mid"].replace(".", "_"));
}


/* Copy the question from the contenteditable div to a hidden input field so it
can be submitted with the form */
function onSubmitQuestion() {
  var question = $("#question").html();
  question = question.replace(/\[/g, "").replace(/\]/g, "");
  var entityMarkedQuestion = removeHtmlInputField(question);

  // If question does not end with a question mark, add one
  var appendix = "";
  if (entityMarkedQuestion.length == 0 || entityMarkedQuestion.slice(-1) != "?") {
    if (entityMarkedQuestion.length > 0 && entityMarkedQuestion.slice(-1) != " ") {
      appendix += " ";
    }
    appendix += "?";
  }
  entityMarkedQuestion += appendix;
  $("#question").html(question + appendix);

  // Prepare form for submission
  console.log("Question sent to Aqqu: " + entityMarkedQuestion);
  $("#q").val(entityMarkedQuestion);
  var qids = getEntityQids(question);
  $("#qids").val(qids.join(","));

  // Disable input field and submit button while waiting for the server response
  $("#question").prop("contenteditable", false);
  $("#ask").prop("disabled", true);

  // Make sure no completion suggestions are offered after disabeling the input field
  maxTimestamp = Date.now();
  removeCompletionButtons(0);

  // Submit form
  $("#questionForm").submit();
  return true;
}

// ---------------------- General ---------------------------------------------

/* In the given component containing one or several text nodes, place the
caret at the given original position within the text node that this position
happens to fall into */
function placeCaretAtPosition(component, position) {
  var children = getAllNodes(component);
  if (position == -1) {
    // Place caret at the end of the input
    var node = children[children.length - 1];
    var newPosition = node.nodeValue.length;
    var data = {node: node, position: newPosition};
    setCaretPosition(data);
    return;
  }
  var totalLength = 0;
  for (var i = 0; i < children.length; i++) {
    if (children[i].nodeValue == null) continue;
    if (position < totalLength + children[i].nodeValue.length) {
      var newPosition = position - totalLength
      var data = {node: children[i], position: newPosition};
      setCaretPosition(data);
      break;
    }
    totalLength += children[i].nodeValue.length;
  };
}


/* Get position of the caret within the given element */
function getCaretCharacterOffsetWithin(element) {
    var caretOffset = 0;
    var doc = element.ownerDocument || element.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel;
    if (typeof win.getSelection != "undefined") {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
            var range = win.getSelection().getRangeAt(0);
            var preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            caretOffset = preCaretRange.toString().length;
        }
    } else if ( (sel = doc.selection) && sel.type != "Control") {
        var textRange = sel.createRange();
        var preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}


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
  // Get value for show completions checkbox from Cookie
  var cookieStr = localStorage.getItem("showCompletions");
  // Default valu of showCompletions (cookieStr == null) is true
  showCompletions = cookieStr == "false" ? false : true
  $('#checkbox').prop("checked", showCompletions);

  // Handle checkbox state change
  $('#checkbox').change(function() {
    if ($('#checkbox').is(":checked")) {
      showCompletions = true;
      getCompletions();
    } else {
      showCompletions = false;
      removeCompletionButtons(0);
    }
    // Store user preference in a Cookie
    localStorage.setItem("showCompletions", showCompletions);
  });

  // Set hidden input qids to data qids. This is needed as for some unknown
  // reason while the data value gets updated by the server, the input value
  // does not.
  var qidsdata = $("#qids").data("qids");
  $("#qids").val(qidsdata);
  var qids = qidsdata.split(",");
  // Create tooltip for each QID
  for (qid of qids) {
    if (qid != "") {
      createTooltip(qid);
    }
  }

  // If a query exists already in the input field, put it into the right format
  var urls = $("#question").data("urls");
  var text = $("#question").text();
  text = putTextIntoSpansInput(text, qids, urls);
  $("#question").html(text);

  // If the input field looses focus and the field contains no text add
  // placeholder text
  $("#question").focusout(function(){
    var element = $(this);
    if (!element.text().replace(" ", "").replace("\u200c", "").length) {
      element.empty();
    }
  });
  $("#question").focusin(function(){
    var element = $(this);
    if (!element.text().replace(" ", "").replace("\u200c", "").length) {
      text = putTextIntoSpansInput("", [], []);
      $("#question").html(text);
      placeCaretAtPosition($('#question')[0], -1);
    }
  });

  if ($(".result").length == 0) {
    // Focus input field when page is loaded and no answers are given
    $("#question").focus();
    // Set caret to the end of the input
    placeCaretAtPosition($('#question')[0], -1);
  }

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
        onSubmitQuestion();
      }
    }
  });

  // Disable default behavior on arrow up (cursor jumps to start position)
  $(document).on("keydown keyup", "#question", function(event) { 
    if(event.which == 38 || event.which == 40){
        event.preventDefault();
    }
  });

  // When redirecting to detailed Aqqu insert current question into input field
  $("#detailed_aqqu").on("click", function(event){
    var question = $("#question").text();
    $("#detailed_aqqu_query").val(question)
  });
});
