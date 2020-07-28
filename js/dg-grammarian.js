dg_grammarian = {
	context: null,
	xmlNode: null,
	editor:  null,
	lin_cache: null
}

dg_grammarian.grammar_call=function(querystring,cont,errcont) {
    http_get_json(this.editor.getGrammarURL()+querystring,cont,this.errcont)
}

dg_grammarian.errcont = function(text,code) { alert(text); }

dg_grammarian.parse = function (sentence, linearization, choices) {
	function collect_info(fid,state) {
		if (fid in state.fids)
			return;
		state.fids[fid] = 0;

		const info = state.chart[fid];
		for (let i in info.brackets) {
			const bracket = info.brackets[i];
			bracket.fid = fid;
			state.offsets.push(bracket.start);
			state.offsets.push(bracket.end);
		}

		info.current = 0;

		for (let i in info.prods) {
			const prod = info.prods[i];
			for (let j in prod.args) {
				collect_info(prod.args[j],state);
			}
		}
	}
	function select_bracket(table,colspan,fid,lex_id) {
		gfwordnet.select_bracket(table,colspan,fid,lex_id);

		if (fid != null) {
			let row = table.firstElementChild;
			while (row != null) {
				if (row.classList.contains("syntax"))
					break;
				row = row.nextElementSibling;
			}
			
			let info = null;
			for (let chart_fid in this.chart) {
				info = this.chart[chart_fid];
				if (info.traverse_fid == fid)
					break;
			}

			if (info == null)
				return;

			let colspan = 0;
			let cell = row.firstElementChild.nextElementSibling;
			while (cell != null) {
				const start = this.offsets[colspan];
				const end   = this.offsets[colspan+cell.colSpan];

				for (let i in info.brackets) {
					const bracket = info.brackets[i];
					if (bracket.start <= start && bracket.end >= end) {
						cell.firstElementChild.classList.add("selected_bracket");
						break;
					}
				}

				colspan += cell.colSpan;
				cell = cell.nextElementSibling;
			}
		}
	}
	function onclick_phrase(phrase,state) {
		let td_cell  = phrase.parentNode;
		let selected = phrase.classList.contains("selected_bracket");

		let start   = null;
		let end     = null;
		let colspan = 0;
		let found   = false;
		let cell    = td_cell.parentNode.firstElementChild.nextElementSibling;
		while (cell != null) {
			const cell_start = state.offsets[colspan];
			const cell_end   = state.offsets[colspan+td_cell.colSpan];

			if (cell == td_cell)
				found = true;

			if (cell.firstElementChild.classList.contains("selected_bracket")) {
				if (start == null) {
					start = cell_start;
					end   = cell_end;
				} else {
					end   = cell_end;
				}
			} else if (found) {
				if (start == null || end == null) {
					start = cell_start;
					end   = cell_end;
				}
				break;
			} else {
				start = null;
				end   = null;
			}

			colspan += cell.colSpan;
			cell = cell.nextElementSibling;
		}

		let brackets = [];
		for (let fid in state.chart) {
			let info = state.chart[fid];
			if (info.traverse_fid != null) {
				for (let i in info.brackets) {
					const bracket = info.brackets[i];
					if (bracket.start <= start && bracket.end >= end) {
						brackets.push(bracket);
					}
				}
			}
		}

		let best = null;
		if (brackets.length > 0) {
			brackets.sort(function (a, b) {
				let cmp = (a.end-a.start) - (b.end-b.start);
				if (cmp == 0)
					cmp = state.chart[a.fid].traverse_fid - state.chart[b.fid].traverse_fid;
			});

			best = brackets[0];
			if (selected) {
				for (let i in brackets) {
					if ((best.end-best.start) < (brackets[i].end-brackets[i].start)) {
						best = brackets[i];
						break;
					}
				}

				if (best == brackets[0]) {
					best = null;
				}
			}
		}

		let lex_id = null;
		let traverse_fid = null;
		if (best != null) {
			const info = state.chart[best.fid];
			traverse_fid = info.traverse_fid;
			lex_id = info.prods[info.current].tree;
		}

		const table = td_cell.parentNode.parentNode;
		bind(select_bracket,state)(table,state.offsets.length,traverse_fid,lex_id);
	}
	function extract_linearization(lins) {
		const table =
			gfwordnet.build_alignment_table(lins,
			                                this.offsets.length,
			                                gfwordnet.selection.current,
			                                bind(select_bracket,this));

		const row = node("tr",{class: "syntax", style: "border-top: 2px solid #66c"}
		                     ,[th(text(gfwordnet.selection.langs[gfwordnet.selection.current].name))]);
		for (let i=1; i < this.offsets.length; i++) {
			const s = sentence.substring(this.offsets[i-1], this.offsets[i])
			                  .replace(" ", "\xa0");
			const cell  = node("span",{style:"display:block; width:100%"},[text(s)]);
			const state = this;
			cell.addEventListener("click", function(e) { onclick_phrase(this, state); });
			row.appendChild(td(cell));
		}
		table.appendChild(row);

		for (let i=this.levels.length-1; i >= 0; i--) {
			const row = this.build_level(this.levels[i],true);
			if (row != null) {
				table.appendChild(row);
			}
		}

		clear(linearization);
		linearization.appendChild(table);
	}
	function extract_parse(result) {
		clear(linearization);
		clear(choices);

		if (!("roots" in result[0])) {
			return;
		}

		let roots = result[0].roots;
		let chart = result[0].chart;

		result[0].current = 0;
		for (let i in roots) {
			let state = { offsets: []
				        , fids: {}
				        , levels: [[roots[i]]]
				        , root: roots[i]
				        , chart: chart
				        , traverse_fid: 0
				        };

			// collect the offsets and initialize the current fields
			collect_info(state.root,state);
			if (state.offsets.length > 0) {
				// build sorted list with unique offsets
				state.offsets.sort(function (a, b) { return a - b; });
				var uniques = [state.offsets[0]];
				for (let i = 1; i < state.offsets.length; i++) {
					if (state.offsets[i-1] !== state.offsets[i]) {
						uniques.push(state.offsets[i]);
					}
				}
				state.offsets = uniques
			}

			state.colspan = function(i,j) {
				return this.offsets.indexOf(j)-this.offsets.indexOf(i);
			}
			state.build_level = function(level,editable) {
				let brackets = []
				for (let j in level) {
					brackets.push(...this.chart[level[j]].brackets);
				}

				if (brackets.length > 0) {
					// build sorted list of unique brackets in left to right order
					brackets.sort(function (a, b) { return a.start - b.start; });
					var uniques = [brackets[0]];
					for (var j = 1; j < brackets.length; j++) {
						if (brackets[j-1].start !== brackets[j].start ||
							brackets[j-1].end   !== brackets[j].end     ) {
							uniques.push(brackets[j]);
						}
					}
					brackets = uniques;
				}

				if (brackets.length > 0 || !editable) {
					// create the actual DOM nodes
					const row = node("tr",{class: "syntax"},[td([])]);

					let end = 0;
					for (let j in brackets) {
						const bracket = brackets[j];
						if (end < bracket.start)
							row.appendChild(node("td",{colspan: this.colspan(end,bracket.start)}
													 ,[]));
						const cell = node("div",{class:"syntax"},[text(state.chart[bracket.fid].cat)]);
						if (editable) {
							cell.dataset.fid = this.chart[bracket.fid].traverse_fid;
							cell.addEventListener("mouseenter",function(e) { dg_grammarian.onmouseenter_bracket(cell, bracket.fid, state); });
							cell.addEventListener("mouseout",dg_grammarian.onmouseout_bracket);
						}
						row.appendChild(node("td",{colspan: this.colspan(bracket.start,bracket.end)},[cell]));
						end = bracket.end;
					}
					if (end < sentence.length)
						row.appendChild(node("td",{colspan: this.colspan(end,sentence.length)},[]));
					return row;
				} else {
					return null;
				}
			}
			state.getAbstractSyntax = function(fid,level) {
				var info = this.chart[fid];
				if (level+1 >= this.levels.length)
					this.levels.push([])

				const prod = info.prods[info.current];
				let   tree = prod.tree;
				if (prod.args.length > 0) {
					for (var j in prod.args) {
						const subtree =
						    this.getAbstractSyntax(prod.args[j],level+1,fid);
						tree += " "+subtree;
						this.levels[level+1].push(prod.args[j]);
					}
					tree = "("+tree+")";
				}

				info.traverse_fid = this.traverse_fid++;

				return tree;
			}
			state.update_ui = function() {
				// initialize the levels and extract an abstract syntax tree
				this.levels.length = 1;
				this.traverse_fid  = 0;
				for (let fid in this.chart) {
					delete this.chart[fid].traverse_fid;
				}
				const tree = this.getAbstractSyntax(this.root,0);
				dg_grammarian.grammar_call("?command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(tree),bind(extract_linearization,this));
			}
			
			state.update_ui();
		}
	}
	dg_grammarian.grammar_call("?command=c-parseToChart&limit=1&from="+gfwordnet.selection.current+"&input="+encodeURIComponent(sentence),extract_parse);
}
dg_grammarian.linearize_ui = function(tree,cell) {
	if (this.lin_cache == null || this.lin_cache.lang != gfwordnet.selection.current) {
		this.lin_cache = {lang: gfwordnet.selection.current, lins: {}};
	}

	if (tree in this.lin_cache.lins) {
		cell.appendChild(text(this.lin_cache.lins[tree]));
	} else {
		function extract_linearization(lins) {
			for (var i in lins) {
				this.cell.appendChild(text(lins[i].text));
				this.lins[this.tree] = lins[i].text;
			}
		}

		var info = {
			cell: cell,
			tree: tree,
			lins: this.lin_cache.lins
		}
		this.grammar_call("?command=c-linearize&to="+gfwordnet.selection.current+"&tree="+encodeURIComponent(tree),bind(extract_linearization,info));
	}
}
dg_grammarian.load_phrases = function(url) {
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

		function init_phrases() {
			var table = element("phrases");
			clear(table);
			var nodes = dg_grammarian.editor.getSentences();
			for (var i = 0; i < nodes.length; i++) {
				var cell = node("td", {onclick: "dg_grammarian.onclick_sentence(this.parentNode, '"+nodes[i].getAttribute("id")+"')"}, []);
				dg_grammarian.linearize_ui(nodes[i].getAttribute("desc"),cell);
				table.appendChild(tr(cell));
			}
		};

		from.addEventListener("multisel_changed", function(e) {
			gfwordnet.selection = e.selection;
			if (e.new_current) {
				init_phrases();
			}
			if (dg_grammarian.context != null) {
				dg_grammarian.context.reset();
				dg_grammarian.regenerate(event.new_language,event.new_current);
			}
		});

		gfwordnet.selection = getMultiSelection(from);
		init_phrases();
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
dg_grammarian.regenerate = function(update_lin,update_choices) {
	var linearization = element('linearization');
	var choices = element('choices');

	var expr = this.editor.getAbstractSyntax(this.xmlNode,this.context);

	if (update_lin) {
		function extract_linearization(lins) {
			const table = gfwordnet.build_alignment_table(lins);
			clear(linearization);
			linearization.appendChild(table);
		}
		dg_grammarian.grammar_call("?command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(expr),extract_linearization);
	}

	if (update_choices) {
		clear(choices);
		for (var i in this.context.choices) {
			var choice = this.context.choices[i];
			var desc   = choice.getNode().getAttribute("desc");
			var edit   = null;
			var cell   = null;

			if (choice.getNode().nodeName == "boolean") {
				edit = node("input", {type: "checkbox", onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				if (desc != null) {
					edit = node("label", {}, [edit]);
					cell = edit;
				}
			} else if (choice.getNode().nodeName == "lexicon") {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				edit.addEventListener("mousedown", this.ontoggle_lexicon_search);

				var nodes       = choice.getOptions();
				var options     = {}
				var lexical_ids = ""
				for (var j = 0; j < nodes.length; j++) {
					var lemma  = nodes[j].getAttribute("desc");
					if (lemma == null) {
						lemma  = nodes[j].getAttribute("name");
					}
					
					var option = node("option", {value: j}, []);
					dg_grammarian.linearize_ui(lemma,option);
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
			} else if (choice.getNode().nodeName == "numeral") {
				cell = td([]);
				choices.appendChild(tr(cell));

				let min = choice.getNode().getAttribute("min");
				if (min == null)
					min = 1;

				let max = choice.getNode().getAttribute("max");
				if (max == null)
					max = 100;

				var edit = node("table", {style: "width: 100%"}, []);

				var spinner =
				       node("input", {type: "range",
					                  min: min, max: max,
					                  value: choice.getChoice(),
					                  style: "width: 100%",
									  onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				var value_edit =
				       node("input", {type: "text",
					                  value: choice.getChoice(),
					                  style: "width: 50px; text-align:right"}, []);
				let index = i;
				value_edit.addEventListener("change", function (e) {
					var value = e.target.value;
					if (value < min)
						value = min;
					if (value > max)
						value = max;
					dg_grammarian.onchange_option(index,value);
				});
				edit.appendChild(tr(node("td", {colspan: 3}, [spinner])));
				edit.appendChild(tr([node("td",{style: "text-align: left"  },[text(min)])
				                    ,node("td",{style: "text-align: center"},[value_edit])
				                    ,node("td",{style: "text-align: right" },[text(max)])
				                    ]));
			} else {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);

				var nodes = choice.getOptions();
				for (var j = 0; j < nodes.length; j++) {
					var desc = nodes[j].getAttribute("desc");
					if (desc == null)
						desc = nodes[j].getAttribute("name");

					var option = node("option", {value: j}, []);
					dg_grammarian.linearize_ui(desc,option);
					if (j == choice.getChoice())
						option.selected = true;
					edit.appendChild(option);
				}
			}

			if (cell != null) {
				dg_grammarian.linearize_ui(desc,cell);
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
			clear(dropdown);
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
dg_grammarian.onclick_sentence = function(row,id) {
	this.context = new ChoiceContext();
	this.xmlNode = this.editor.getNode(id);
	this.regenerate(true,true);

	var table = row.parentNode;
	var tr = table.firstChild;
	while (tr != null) {
		tr.classList.remove("current");
		tr = tr.nextSibling;
	}

	row.classList.add("current");
}
dg_grammarian.onchange_option = function(i,j) {
	this.context.choices[i].setChoice(j);
	this.context.reset();
	this.regenerate(true,true);
}
dg_grammarian.onmouseenter_bracket = function(cell,fid,state) {
	if (cell.firstElementChild != null) {
		// if there is a button already
		return;
	}

	const info = state.chart[fid];

	cell.parentNode.parentNode.firstElementChild.innerText = info.prods[info.current].tree;

	if (gfwordnet.popup != null && gfwordnet.popup.parentNode != null) {
		gfwordnet.popup.parentNode.removeChild(gfwordnet.popup);
		gfwordnet.popup = null;
	}

	if (info.prods.length > 1) {
		const btn = img("edit.png");
		btn.addEventListener("click", function (e) {dg_grammarian.onclick_edit(cell,fid,state)});
		gfwordnet.popup = div_class("floating",[btn]);
		cell.appendChild(gfwordnet.popup);
	}
}
dg_grammarian.onmouseout_bracket = function(e) {
	clear(this.parentNode.parentNode.firstElementChild);
}
dg_grammarian.onclick_edit = function(bracket,fid,state) {
	const row   = bracket.parentNode.parentNode;
	const table = row.parentNode;
	const info  = state.chart[fid];

	let prev = row.previousElementSibling;
	while (prev != null) {
		if (prev.previousElementSibling.className != "syntax")
			break;

		let colspan = 0;
		let cell    = prev.firstElementChild.nextElementSibling;
		while (cell != null) {
			let start = state.offsets[colspan];
			let end   = state.offsets[colspan + cell.colSpan];

			for (let i in info.brackets) {
				const bracket = info.brackets[i];

				if (start >= bracket.start && end <= bracket.end) {
					clear(cell);
					cell.className = "";
					break;
				}
			}

			colspan += cell.colSpan;
			cell = cell.nextElementSibling;
		}

		prev = prev.previousElementSibling;
	}


	for (let i in info.prods) {
		const prod = info.prods[i];

		const choice_row = state.build_level(prod.args,false);
		const edit = node("input", {type: "radio", name:"choice"+fid}, []);
		edit.checked = (i == info.current);
		edit.addEventListener("change", function (e) { dg_grammarian.onchange_production(fid,state,i); });
		choice_row.firstElementChild.appendChild(node("label", {}, [edit, text(prod.tree)]));
		table.insertBefore(choice_row,row);
	}
	
	const btn = node("span", {style: "cursor: pointer"}, [text("\u2715")]);
	btn.addEventListener("click", function(e) { state.update_ui(); });
	bracket.appendChild(text("\xA0"));
	bracket.appendChild(btn);
	
	if (gfwordnet.popup != null)
		gfwordnet.popup.parentNode.removeChild(gfwordnet.popup);
}
dg_grammarian.onchange_production = function(fid,state,i) {
	const info = state.chart[fid];
	info.current = i;
	state.update_ui();
}
