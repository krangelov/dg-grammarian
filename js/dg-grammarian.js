dg_grammarian = {
	context: null,
	xmlNode: null,
	editor:  null
}

dg_grammarian.grammar_call=function(querystring,cont,errcont) {
    http_get_json(this.editor.getGrammarURL()+querystring,cont,errcont)
}

dg_grammarian.errcont = function(text,code) { }

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
	function extract_phrases(xml) {
		dg_grammarian.editor =
			new ConceptualEditor(xml.responseXML);

		var table = document.getElementById("phrases");
		var nodes = dg_grammarian.editor.getSentences();
		for (var i = 0; i < nodes.length; i++) {
			table.appendChild(tr(node("td", {onclick: "dg_grammarian.onclick_sentence(this.parentNode,getMultiSelection(element('from')), '"+nodes[i].getAttribute("id")+"',element('linearization'), element('choices'))"}, [text(nodes[i].getAttribute("desc"))])));
		}
	}

	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			extract_phrases(this);
		}
	};
	xhttp.open("GET", url, true);
	xhttp.send();
}
dg_grammarian.regenerate = function(selection,linearization,choices) {
	var expr = this.editor.getAbstractSyntax(this.xmlNode,this.context);

	function extract_linearization(lins) {		
		dg_grammarian.update_linearization(selection, lins, linearization, choices);
	}
	dg_grammarian.grammar_call("?command=c-bracketedLinearize&to="+selection.langs_list.join("%20")+"&tree="+encodeURIComponent(expr),extract_linearization,dg_grammarian.errcont);

	choices.innerHTML = "";
	for (var i in this.context.choices) {
		var choice = this.context.choices[i];
		var desc   = choice.getNode().getAttribute("desc");
		var edit   = null;

		if (choice.getNode().nodeName == "boolean") {
			edit = node("input", {type: "checkbox", onchange: "dg_grammarian.onchange_option("+i+",this.value,getMultiSelection(element('from')), element('linearization'), element('choices'))"}, []);
			if (desc != null) {
				edit = node("label", {}, [edit,text(desc)]);
			}
		} else {
			choices.appendChild(tr(td(text(desc))));

			edit = node("select", {style: "width: 100%",
				                   onchange: "dg_grammarian.onchange_option("+i+",this.value,getMultiSelection(element('from')), element('linearization'), element('choices'))"}, []);

			var nodes = choice.getOptions();
			for (var j = 0; j < nodes.length; j++) {
				var option = node("option", {value: j}, [text(nodes[j].getAttribute("desc"))]);
				if (j == choice.getChoice())
					option.selected = true;
				edit.appendChild(option);
			}
		}

		choices.appendChild(tr(td(edit)));
	}
}
dg_grammarian.onclick_sentence = function(row,selection,id,linearization,choices) {
	this.context = new ChoiceContext();
	this.xmlNode = this.editor.getNode(id);
	this.regenerate(selection,linearization,choices);
	
	var table = row.parentNode;
	var tr = table.firstChild;
	while (tr != null) {
		tr.classList.remove("current");
		tr = tr.nextSibling;
	}

	row.classList.add("current");
}
dg_grammarian.onchange_option = function(i,j,selection,linearization,choices) {
	this.context.choices[i].setChoice(j);
	this.context.reset();
	this.regenerate(selection,linearization,choices);
}
