dg_grammarian = {
	context: null,
	xmlNode: null,
	editor:  null
}

dg_grammarian.grammar_call=function(querystring,cont,errcont) {
    http_get_json(this.editor.getGrammarURL()+querystring,cont,errcont)
}

dg_grammarian.errcont = function(text,code) { alert(text); }

dg_grammarian.parse = function (selection, sentence, linearization, choices) {
	function extract_linearization(lins) {
		dg_grammarian.update_linearization(selection, lins, linearization, choices);
		choices.innerHTML="";
	}
	function extract_parse(parses) {
		if ("trees" in parses[0]) {
			dg_grammarian.grammar_call("?command=c-bracketedLinearize&to="+selection.langs_list.join("%20")+"&tree="+encodeURIComponent(parses[0].trees[0].tree),extract_linearization,dg_grammarian.errcont);
		} else {
			linearization.innerHTML="";
			choices.innerHTML="";
		}
	}
	dg_grammarian.grammar_call("?command=c-parse&limit=1&from="+selection.current+"&input="+encodeURIComponent(sentence),extract_parse,dg_grammarian.errcont);
}
dg_grammarian.update_linearization = function (selection, lins, linearization, choices) {
	function taggedBrackets(brackets) {
		var tags = [];
		for (var i in brackets) {
			if ("bind" in brackets[i])
				bind_state = brackets[i].bind;
			else {
				if (!bind_state) {
					tags.push(text(" "));
					bind_state = true;
				}

				if ("token" in brackets[i]) {
					tags.push(text(brackets[i].token));
					bind_state = false;
				} else {
					tags.push(node("span", {"fid": brackets[i].fid,
											"fun": brackets[i].fun,
											"onclick": "dg_grammarian.onclick_bracket(event, this)"},
								   taggedBrackets(brackets[i].children)));
				}
			}
		}
		return tags;
	}
	var rows = []
	for (var i in lins) {
		var lin = lins[i];
		bind_state = true;
		rows.push(tr([th(text(selection.langs[lin.to].name)),td(taggedBrackets(lin.brackets))]));
	}
	linearization.innerHTML="";
	linearization.appendChild(node("table",{class: "result"},rows), this.nextSibling);
}
dg_grammarian.load_phrases = function(url) {
	function extract_linearization(lins) {
		for (var i in lins) {
			this.appendChild(text(lins[i].text));
		}
	}

	function extract_phrases(xml) {
		dg_grammarian.editor =
			new ConceptualEditor(xml);

		var langs = dg_grammarian.editor.getLanguages();
		var from  = element('from');

		var thead = node("thead");
		var tbody = node("tbody");
		for (var i = 0; i < langs.length; i++) {
			var inp = node("input", {type: "checkbox", name: langs[i].concr})
			inp.checked = langs[i].output;
			inp.addEventListener("click", clickItem);

			var lbl = node("td", {}, [text(langs[i].name)]);
			lbl.addEventListener("click", changeItem);

			tbody.appendChild(tr([lbl,td(inp)]));

			if (langs[i].input) {
				var row = node("tr", {onclick: "showCheckboxes(this.parentNode.parentNode)"}, 
				                     [th(text(langs[i].name)),th(img("triangle.png"))]);
				thead.appendChild(row);
			}
		}
		from.appendChild(thead);
		from.appendChild(tbody);

		function init_phrases(selection) {
			var table = element("phrases");
			table.innerHTML="";
			var nodes = dg_grammarian.editor.getSentences();
			for (var i = 0; i < nodes.length; i++) {
				var cell = node("td", {onclick: "dg_grammarian.onclick_sentence(this.parentNode,getMultiSelection(element('from')), '"+nodes[i].getAttribute("id")+"')"}, []);
				dg_grammarian.grammar_call("?command=c-linearize&to="+selection.current+"&tree="+encodeURIComponent(nodes[i].getAttribute("desc")),bind(extract_linearization,cell),dg_grammarian.errcont);
				table.appendChild(tr(cell));
			}
		};

		from.addEventListener("multisel_changed", function(e) {
			if (e.new_current) {
				init_phrases(e.selection);
			}
			if (dg_grammarian.context != null) {
				dg_grammarian.context.reset();
				dg_grammarian.regenerate(e.selection,event.new_language,event.new_current);
			}
		});

		var selection = getMultiSelection(from);
		init_phrases(selection);
	}

	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200 && this.responseXML != null) {
			extract_phrases(this.responseXML);
		}
	};
	xhttp.open("GET", url, true);
	xhttp.send();
}
dg_grammarian.regenerate = function(selection,update_lin,update_choices) {
	var linearization = element('linearization');
	var choices = element('choices');

	var expr = this.editor.getAbstractSyntax(this.xmlNode,this.context);

	if (update_lin) {
		function extract_linearization(lins) {
			dg_grammarian.update_linearization(selection, lins, linearization, choices);
		}
		dg_grammarian.grammar_call("?command=c-bracketedLinearize&to="+selection.langs_list.join("%20")+"&tree="+encodeURIComponent(expr),extract_linearization,dg_grammarian.errcont);
	}

	if (update_choices) {
		function extract_ui_linearization(lins) {
			for (var i in lins) {
				this.appendChild(text(lins[i].text));
			}
		}

		choices.innerHTML = "";
		for (var i in this.context.choices) {
			var choice = this.context.choices[i];
			var desc   = choice.getNode().getAttribute("desc");
			var edit   = null;
			var cell   = null;

			if (choice.getNode().nodeName == "boolean") {
				edit = node("input", {type: "checkbox", onchange: "dg_grammarian.onchange_option("+i+",this.value,getMultiSelection(element('from')))"}, []);
				if (desc != null) {
					edit = node("label", {}, [edit]);
					cell = edit;
				}
			} else if (choice.getNode().nodeName == "lexicon") {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value,getMultiSelection(element('from')))"}, []);
				edit.addEventListener("mousedown", this.ontoggle_lexicon_search);

				var nodes       = choice.getOptions();
				var options     = {}
				var lexical_ids = ""
				for (var j = 0; j < nodes.length; j++) {
					var lemma  = nodes[j].getAttribute("desc");
					var option = node("option", {value: j}, []);
					dg_grammarian.grammar_call("?command=c-linearize&to="+selection.current+"&tree="+encodeURIComponent(lemma),bind(extract_ui_linearization,option),dg_grammarian.errcont);
					if (j == choice.getChoice())
						option.selected = true;
					edit.appendChild(option);
					options[lemma] = option;
					lexical_ids = lexical_ids + " " + lemma;
				}

				var extract_senses = function (senses) {
					for (var i in senses.result) {
						for (var lemma in senses.result[i].lex_ids) {
							if (lemma in this) {
								this[lemma].dataset.gloss = senses.result[i].gloss;
							}
						}
					}
				}
				gfwordnet.sense_call("lexical_ids="+encodeURIComponent(lexical_ids),bind(extract_senses,options),this.errcont);

				edit = div_class("lexicon-select", [edit]);
			} else {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value,getMultiSelection(element('from')))"}, []);

				var nodes = choice.getOptions();
				for (var j = 0; j < nodes.length; j++) {
					var option = node("option", {value: j}, []);
					dg_grammarian.grammar_call("?command=c-linearize&to="+selection.current+"&tree="+encodeURIComponent(nodes[j].getAttribute("desc")),bind(extract_ui_linearization,option),dg_grammarian.errcont);
					if (j == choice.getChoice())
						option.selected = true;
					edit.appendChild(option);
				}
			}

			if (cell != null) {
				dg_grammarian.grammar_call("?command=c-linearize&to="+selection.current+"&tree="+encodeURIComponent(desc),bind(extract_ui_linearization,cell),dg_grammarian.errcont);
			}

			choices.appendChild(tr(td(edit)));
		}
	}
}
dg_grammarian.ontoggle_lexicon_search = function(e) {
	if (dg_grammarian.current_lexicon_search != null) {
		var div   = dg_grammarian.current_lexicon_search.getElementsByTagName("DIV")[0];
		var input = dg_grammarian.current_lexicon_search.getElementsByTagName("INPUT")[0];
		var sel   = dg_grammarian.current_lexicon_search.getElementsByTagName("SELECT")[0];

		var table = div.getElementsByTagName("TABLE")[0];

		var n = e.target;
		while (n != null) {
			if (n == table) {
				sel.value = e.target.parentNode.dataset.value;
				var change_event = new Event('change');
				change_event.value = sel.value;
				sel.dispatchEvent(change_event);
			}
			n = n.parentNode;
		}
		div.parentNode.removeChild(div);
		input.parentNode.removeChild(input);
		window.removeEventListener("mousedown", dg_grammarian.ontoggle_lexicon_search);
		dg_grammarian.current_lexicon_search = null;
	} else {
		var select = e.target;
		var width  = (select.clientWidth - 20) + "px";

		var input = node("input", {type: "text"}, []);
		input.style.width = width;
		select.parentNode.appendChild(input);
		input.focus();

		var dropdown = node("table", {}, []);
		select.parentNode.appendChild(node("div",{style: "min-width: "+e.target.clientWidth+"px"},[dropdown]));
		input.focus();

		var fill_table = function(prefix) {
			var option = select.firstElementChild;
			while (option != null) {
				if (option.innerText.startsWith(prefix)) {
					var row = tr([td([node("strong",{},[text(option.innerText+".")]),text(" "+option.dataset.gloss)])]);
					row.dataset.value = option.value;
					dropdown.appendChild(row);
				}
				option = option.nextElementSibling;
			}
		}

		input.addEventListener("input", function(e) {
			dropdown.innerHTML = "";
			fill_table(e.target.value);
		});

		fill_table("");

		dg_grammarian.current_lexicon_search = select.parentNode;
		window.addEventListener("mousedown", dg_grammarian.ontoggle_lexicon_search);
	}

	e.stopPropagation();
	e.returnValue = false;
	return false;
}
dg_grammarian.onclick_sentence = function(row,selection,id) {
	this.context = new ChoiceContext();
	this.xmlNode = this.editor.getNode(id);
	this.regenerate(selection,true,true);

	var table = row.parentNode;
	var tr = table.firstChild;
	while (tr != null) {
		tr.classList.remove("current");
		tr = tr.nextSibling;
	}

	row.classList.add("current");
}
dg_grammarian.onchange_option = function(i,j,selection) {
	this.context.choices[i].setChoice(j);
	this.context.reset();
	this.regenerate(selection,true,true);
}
