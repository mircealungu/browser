var ANIMATION_SPEED = 100,
    HEIGHT = 541,
    WIDTH = 740;

var highlight_when_unhighlighting = false,
    zeeguu_active = false,
    selection_mode = false;

var this_url = "unknown"

browser.sendMessage("get_tab_url",function(tab_url) {
    this_url = tab_url;
})

tooltipVisible = false;



/*
 This is the function in charge with highlighting the user's words
 we put them between the zeeguu-visited links...
 */
function highlight_words(words) {

    var all = document.querySelectorAll('p');

    for (var i=0, max=all.length; i < max; i++) {
        var parent = all[i];

        var textNode = parent.firstChild;
        if (textNode != null)
            /*
            Here we used to have a test on textNode being of type text (3)
            but it didn't work. so now we replace everything in all the children.
            It seems to work for now.
             */
            for (j = 0; j < words.length; j++) {
                var rgxp = new RegExp(" (" + words[j]+") ", 'gi');
                var repl = ' <span class="zeeguu-visited">$1</span> ';
                parent.innerHTML = parent.innerHTML.replace(rgxp, repl);
            }
    }
}



/*
  This is required to populate the popup window
 */
function term_context_url_triple(selection) {
    if (!selection.baseNode || selection.baseNode.nodeType != 3) {
        return null;
    }
    var term = selection.toString();
    if (term.length < 1) {
        return null;
    }
    var context = $(selection.baseNode.parentNode).text();
    try {
        context = $.trim(context.match(/\(?[^\.!\?]+[\.!\?]\)?/g).filter(function (each) {
            return each.indexOf(term) >= 0;
        })[0])
    } catch (e) {
        context = "";
    }

    return {
        term: term,
        context: context,
        url:this_url
    };
}


/*

This sets an event listener for a message
of the type PAGE_NEEDS_WORD_TRANSLATION. This will be sent
sometimes from the page, and must trigger the
plugin to show up with the translation.

 */
    var port = chrome.runtime.connect();
    window.addEventListener("message", function(event) {
        // We only accept messages from ourselves
        if (event.source != window)
            return;

        if (event.data.type && (event.data.type == "PAGE_NEEDS_WORD_TRANSLATION")) {
            message = {
                url: event.data.url,
                context: event.data.context,
                term: event.data.term
            }

            browser.sendMessage("ZM_SHOW_TRANSLATION", message);
        }
    }, false);




loadState(function() {

    // The dictionary frame
    if (window.name == "zeeguu") {
        $(document).mouseup(function() {
            var selection = browser.getSelection();
            var message = term_context_url_triple(selection);
            if (message === null) {
                return;
            }
            browser.sendMessage("contribute", message);
        });

        addStateChangeListener("links", function(links) {
            toggle_selection_mode(!links);
        });

        toggle_selection_mode(!state.links);


    // Any frame
    } else {

        var translate_selection = function(eventData) {
            var selection = browser.getSelection();
            var message = term_context_url_triple(selection);
            if (message === null) {
                return;
            }
            highlight_when_unhighlighting = true;
            browser.sendMessage("ZM_SHOW_TRANSLATION", message);
            console.log("sent message translate...")
        };

        $(document).mouseup(function(eventData) {
            if (state.selectionMode) {
                console.log("logging from content_script.js:mouseUp...")
                translate_selection(eventData);
            }
        }).click(function() {
            if (zeeguu_active) {
                browser.sendMessage("close");
            }
        }).dblclick(function(eventData) {
            if (state.fast) {
                translate_selection(eventData);
            }
        });

        $(function() {
            if (state.selectionMode) {
                toggle_selection_mode(true);
            }
        });

        browser.addMessageListener("ZM_SHOW_TRANSLATION", function(data) {

            zeeguu_active = true;
            var selection = term_context_url_triple(browser.getSelection());

            if (selection !== null) {
                // this is the magic regex for splitting in sentences which often works for english.
                console.log(selection.context)
                data.context = $.trim(selection.context.match(/\(?[^\.!\?]+[\.!\?]\)?/g).filter(function(each){return each.indexOf(data.term)>=0;})[0])
                highlight_when_unhighlighting = true;
            }
        });

        addStateChangeListener("selectionMode", function(selectionMode) {
            toggle_selection_mode(selectionMode);
        });

        browser.addMessageListener("unhighlight", function(data) {
            unhighlight();
        });

        function translate_word_action_new(data) {
            console.log(browser.getSelectionElement());
        }

        function translate_word_action(data) {
            dont_close = true;  // Abort the closing timer if it was started before this interaction
//                console.log("make sure we have url here...")
            var url = browser.zeeguuUrl(data.term, data.url, data.context);
            if (!is_frameset()) {
                if ($("#zeeguu").size()) {
                    $("#zeeguu").attr("src", url);
                } else {
                    $("body").append('<iframe src="' + url + '" id="zeeguu" scrolling="no" />');
                    $("#zeeguu").animate({bottom: "0px"}, ANIMATION_SPEED);
                }
            } else {
                browser.sendMessage("window", {
                    url: url
                });
            }
            zeeguu_open = true;
            browser.sendMessage("unhighlight");
            browser.sendMessage("update_state", {
                selectionMode: false
            });
            window.setTimeout(function() {
                dont_close = true;  // Abort the closing timer if it was started after this interaction
            }, 200);
        };


        /************************************

         This is the  context of the
         original page.

        *************************************/

        if (window.top == window.self) {

            var translate_selection = function(eventData) {
                var selection = browser.getSelection();
                var message = term_context_url_triple(selection);
                if (message === null) {
                    return;
                }
                highlight_when_unhighlighting = true;
                browser.sendMessage("ZM_SHOW_TRANSLATION", message);
                console.log("sent message translate...")
            };



            // Add bubble to the top of the page.

            var bubbleDOM = document.createElement('div');
            bubbleDOM.setAttribute('class', 'selection_bubble');
            document.body.appendChild(bubbleDOM);


            // Let's listen to mouseup DOM events.
            document.addEventListener('mouseup', function (e) {
                var word_to_lookup = window.getSelection().toString();


                if (word_to_lookup.length > 0) {
                    var message = term_context_url_triple(browser.getSelection());
                    renderBubble(e.pageX, e.pageY);

                    /*
                     This function is called after and if we get
                     a translation from the DB
                     */
                    function update_bubble_with_translation(translation) {
                        if (translation) {
                            bubbleDOM.innerHTML = word_to_lookup;
                            bubbleDOM.innerHTML += "<br/>=</br>"+ translation;
                            bubbleDOM.innerHTML += "<br/><br/><hr/>";

                            var more = document.createElement('span');
                            more.innerHTML = "more ";
                            more.addEventListener('mouseup', function (e) {
                                /*
                                 I guess here we must send a message from
                                 the page that will be intercepted by the
                                 plugin to open the full dictionary if one
                                 exists...
                                 */

                                var script = document.createElement("script");
                                message.type = "PAGE_NEEDS_WORD_TRANSLATION";

                                script.innerHTML = 'window.postMessage('+JSON.stringify(message)+', "*");';
                                document.body.appendChild(script);
                            });
                            bubbleDOM.appendChild(more);

                            var close = document.createElement('span');
                            close.innerHTML = "close ";
                            close.addEventListener('mousedown', function (e) {
                                bubbleDOM.style.visibility = 'hidden';
                            });
                            bubbleDOM.appendChild(close);

                        }
                    }
                    get_translation_from_db(word_to_lookup, update_bubble_with_translation);

                } else {
                    /*
                    We have clicked somewhere and deselected the
                    text. No reason for the translation to still
                    be on.
                     */
                    bubbleDOM.style.visibility = 'hidden';
                }
            }, false);

            // Move that bubble to the appropriate location.
            function renderBubble(mouseX, mouseY) {
                bubbleDOM.innerHTML = "Translating...";
                bubbleDOM.style.top = mouseY + 16 +  'px';
                bubbleDOM.style.left = mouseX + 16 + 'px';
                bubbleDOM.style.visibility = 'visible';
            }






            var closingTimer;
            var dont_close = false;
            var zeeguu_open = false;

            browser.addMessageListener("ZM_SHOW_TRANSLATION", translate_word_action);

            browser.addMessageListener("close", function(data) {
                if (zeeguu_open && !closingTimer) {
                    dont_close = false;
                    window.setTimeout(function() {
                        if (!dont_close) {
                            closingTimer = null;
                            hide_zeeguu();
                            zeeguu_open = false;
                        }
                    }, 200);
                }
            });

            browser.addMessageListener("browser_action", function(data) {
                toggleSelectionModeBox(!selection_mode);
                browser.sendMessage("selection_mode", {
                    enabled: !selection_mode
                });
            });
        }
    }
});

function is_frameset() {
    return !$("body").length;
}

function hide_zeeguu(callback) {
    browser.sendMessage("unhighlight");
    if (!is_frameset()) {
        $("#zeeguu").animate({bottom: -HEIGHT}, ANIMATION_SPEED, function() {
            $(this).detach();
            if (callback) {
                callback();
            }
        });
    } else {
        close_zeeguu_window();
    }
}

function highlight() {
    highlight_when_unhighlighting = false;
    var span = document.createElement("span");
    span.className = "zeeguu-highlight";

    try {
        browser.getSelection().getRangeAt(0).surroundContents(span);
    } catch (e) {

    }
}

function unhighlight() {
//    $(".zeeguu-highlight").addClass("zeeguu-remove");
    $(".zeeguu-highlight").addClass("zeeguu-visited");
    if (highlight_when_unhighlighting) {
        highlight();
    }
//    $(".zeeguu-remove").each(function() {
//        var parent = this.parentNode,
//            lastChild = this.lastChild,
//            nextlastChild;
//        parent.replaceChild(lastChild, this);
//        while(this.lastChild) {
//            nextlastChild = this.lastChild;
//            parent.insertBefore(nextlastChild, lastChild);
//            lastChild = nextlastChild;
//        }
//        parent.normalize();
//    });
}

function toggle_selection_mode(new_selection_mode) {
    if (selection_mode == new_selection_mode) {
        return;
    }
    if (new_selection_mode) {
        $("a").each(function(i, e) {
            e = $(e);
            e.attr("data-zeeguu-href", e.attr("href"));
            e.removeAttr("href");
        });
    } else {
        $("a").each(function(i, e) {
            e = $(e);
            e.attr("href", e.attr("data-zeeguu-href"));
            e.removeAttr("data-zeeguu-href");
        });
    }
    selection_mode = new_selection_mode;
}

browser.sendMessage("get_user_words",function(user_words) {
    highlight_words(user_words)
})

