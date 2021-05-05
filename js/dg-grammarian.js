dg_grammarian = {};

(function(){
	dg_grammarian.context   = null;
	dg_grammarian.sentence  = null;
	dg_grammarian.editor    = null;
    dg_grammarian.edit_mode = true;
	dg_grammarian.lin_cache = null;

    Blockly.HSV_SATURATION = 0.77;
    Blockly.HSV_VALUE      = 0.93;

    const SynsetField = function(opt_value, opt_validator) {
        opt_value = this.doClassValidation_(opt_value);
        if (opt_value == null)
            opt_value = "<function>";
        SynsetField.superClass_.constructor.call(
                                      this, opt_value, opt_validator);
        this.SERIALIZABLE = true;
    };
    SynsetField.fromJson = function(options) {
        const value = Blockly.utils.replaceMessageReferences(options['value']);
        return new SynsetField(value);
    };
    SynsetField.prototype.toXml = function(fieldElement) {
        fieldElement.textContent = this.value_;
        return fieldElement;
    };
    SynsetField.prototype.fromXml = function(fieldElement) {
        var value = fieldElement.textContent;
        this.setValue(value);
    };
    Blockly.utils.object.inherits(SynsetField, Blockly.Field);

    SynsetField.prototype.showEditor_ = function() {
        search = div_class("wn_search",[text("x")]);
        document.body.appendChild(search);
    };

    Blockly.fieldRegistry.register("field_wn_synset", SynsetField);

    let arity_mutator = {
        mutationToDom: function() {
            let arity = 0;
            for (;;arity++) {
                const inp = this.getInput("arg "+arity);
                if (inp == null)
                    break;
            }
            if (arity > 0) {
                const container = document.createElement('mutation');
                container.setAttribute("arity", arity);
                return container;
            }
            return null;
        },
        domToMutation: function(xmlElement) {
            var arity = xmlElement.getAttribute('arity');
            for (let i = 0; i < arity; i++) {
                this.appendValueInput('arg '+i);
            }
        }
    };
    Blockly.Extensions.registerMutator("dg_arity_mutator", arity_mutator);

    let desc_mutator = {
        mutationToDom: function() {
            const inp = this.getInput("desc");
            if (inp != null) {
                const container = document.createElement('mutation');
                container.setAttribute("has_desc", 1);
                return container;
            }
            return null;
        },
        domToMutation: function(xmlElement) {
            var has_desc = xmlElement.getAttribute("has_desc");
            if (has_desc == 1) {
                this.appendValueInput("desc")
                    .appendField('ui');
            }
        }
    };
    Blockly.Extensions.registerMutator("dg_desc_mutator", desc_mutator);

    function sequenceToCode(block, name) {
        let code = "";
        let targetBlock = block.getInputTargetBlock(name);
        while (targetBlock != null) {
            const func = Blockly.JavaScript[targetBlock.type];
            if (code != "")
                code += ", ";
            let res = func.call(targetBlock, targetBlock);
            code += res;
            if (targetBlock.nextConnection == null)
                break;
            targetBlock = targetBlock.nextConnection.targetBlock();
        }
        return code;
    }

    Blockly.Blocks['ConceptualEditor.When'] = {
      init: function() {
        this.jsonInit({
          "message0": 'when %1',
          "args0": [
            {
              "type": "input_value",
              "name": "CLASS",
              "check": "Boolean"
            }
          ],
          "message1": "then %1",
          "args1": [
            {
              "type": "input_statement",
              "name": "do",
            }
          ],
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };

    Blockly.Blocks["ConceptualEditor.Sentence"] = {
      init: function() {
        this.jsonInit({
          "message0": "sentence %1",
          "args0": [
            {
              "type":  "input_value",
              "name":  "content",
              "check": "abstract_syntax"
            }
          ],
          "message1": "ui %1",
          "args1": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "colour": 44,
          "tooltip": "Describes a family of phrases",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Sentence"] = function(block) {
        let code = "dg_grammarian.editor.addSentence(";

        code += Blockly.JavaScript.quote_(block.id)+",";

        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code += ","+Blockly.JavaScript.valueToCode(block, 'content', Blockly.JavaScript.ORDER_NONE);

        code += ")";
        return code;
    };

    Blockly.Blocks['ConceptualEditor.Function'] = {
      init: function() {
        this.jsonInit({
          "message0": '%1',
          "args0": [
            {
              "type": "field_wn_synset",
              "name": "name"
            }
          ],
          "output": "abstract_syntax",
          "inputsInline": true,
          "colour": 200,
          "mutator": "dg_arity_mutator",
          "tooltip": "Applies a function to a number of arguments"
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Function"] = function(block) {
        let code = "new ConceptualEditor.Function(";
        
        code += Blockly.JavaScript.quote_(block.getFieldValue('name'));
        for (let i = 0; ;i++) {
            let arg_code = Blockly.JavaScript.valueToCode(block, 'arg '+i, Blockly.JavaScript.ORDER_NONE);
            if (arg_code == null || arg_code == "")
                break;
            code += ", "+arg_code;
        }
        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.Option'] = {
      init: function() {
        this.jsonInit({
          "message0": "option %1",
          "args0": [
            {
              "type": "input_statement",
              "name": "do",
            }
          ],
          "message1": "ui %1",
          "args1": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "output": "abstract_syntax",
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Option"] = function(block) {
        let code =
            "new ConceptualEditor.Option(";

        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code += ",";
        code += sequenceToCode(block, "do");

        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.Lexicon'] = {
      init: function() {
        this.jsonInit({
          "message0": 'lexicon %1',
          "args0": [
            {
              "type": "input_statement",
              "name": "do",
            }
          ],
          "message1": "ui %1",
          "args1": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "output": "abstract_syntax",
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Lexicon"] = function(block) {
        let code =
            "new ConceptualEditor.Lexicon(";

        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code += ",";
        code += sequenceToCode(block, "do");

        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks["ConceptualEditor.Boolean"] = {
      init: function() {
        this.jsonInit({
          "message0": 'checkbox',
          "message1": 'on %1',
          "args1": [
            {
              "type":  "input_value",
              "name":  "checked",
              "check": "abstract_syntax",
            }
          ],
          "message2": 'off %1',
          "args2": [
            {
              "type":  "input_value",
              "name":  "unchecked",
              "check": "abstract_syntax",
            }
          ],
          "message3": "ui %1",
          "args3": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "output": "abstract_syntax",
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Boolean"] = function(block) {
        let code =
            "new ConceptualEditor.Boolean(";

        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code += ",";
        code += Blockly.JavaScript.valueToCode(block, 'checked',   Blockly.JavaScript.ORDER_NONE);
        code += ",";
        code += Blockly.JavaScript.valueToCode(block, 'unchecked', Blockly.JavaScript.ORDER_NONE);

        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.Numeral'] = {
      init: function() {
        this.jsonInit({
          "message0": "numeral from %1 to %2 default %3",
          "args0": [
            {
              "type":  "field_number",
              "name":  "min",
              "value": 0
            },
            {
              "type": "field_number",
              "name": "max",
              "value": 100
            },
            {
              "type": "field_number",
              "name": "default",
              "value": 5
            }
          ],
          "message1": "ui %1",
          "args1": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "output": "abstract_syntax",
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Numeral"] = function(block) {
        let code =
            "new ConceptualEditor.Numeral(";

        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code +=  ","+block.getFieldValue('min');
        code +=  ","+block.getFieldValue('max');
        code +=  ","+block.getFieldValue('default');
        
        code +=  ")";

        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks["ConceptualEditor.Item"] = {
      init: function() {
        this.jsonInit({
          "message0": "item %1",
          "args0": [
            {
              "type": "input_value",
              "name": "of",
              "check": "abstract_syntax"
            }
          ],
          "mutator": "dg_desc_mutator",
          "previousStatement": null,
          "nextStatement": null,
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Item"] = function(block) {
        let code = "new ConceptualEditor.Item(";
        code += Blockly.JavaScript.valueToCode(block, 'of', Blockly.JavaScript.ORDER_NONE);

        if (block.getInput("desc") != null) {
            code += ","+Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        }

        code += ")";
        return code;
    };

    Blockly.Blocks["ConceptualEditor.Definition"] = {
      init: function() {
        this.jsonInit({
          "message0": '%1',
          "args0": [
            {
              "type": "field_input",
              "name": "id",
              "value": "<definition>",
              "spellcheck": false
            }
          ],
          "message1": 'do %1',
          "args1": [
            {
              "type": "input_value",
              "name": "do",
              "check": "abstract_syntax"
            }
          ],
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Definition"] = function(block) {
        const code =
            "dg_grammarian.editor.addDefinition("+
            Blockly.JavaScript.quote_(block.getFieldValue('id'))+
            ", "+
            Blockly.JavaScript.valueToCode(block, 'do', Blockly.JavaScript.ORDER_NONE)+
            ");";
        return code;
    };

    Blockly.Blocks['ConceptualEditor.Call'] = {
      init: function() {
        this.jsonInit({
          "message0": 'call %1',
          "args0": [
            {
              "type": "field_input",
              "name": "ref",
              "value": "<definition>",
              "spellcheck": false
            }
          ],
          "inputsInline": true,
          "mutator": "dg_arity_mutator",
          "output": "abstract_syntax",
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Call"] = function(block) {
        let code = "new ConceptualEditor.Call(";
        code += Blockly.JavaScript.quote_(block.getFieldValue("ref"));
        for (let i = 0; ;i++) {
            let arg_code = Blockly.JavaScript.valueToCode(block, "arg "+i, Blockly.JavaScript.ORDER_NONE);
            if (arg_code == null || arg_code == "")
                break;
            code += ", "+arg_code;
        }
        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.Argument'] = {
      init: function() {
        this.jsonInit({
          "message0": 'argument %1',
          "args0": [
            {
              "type": "field_number",
              "precision": 0,
              "name": "arg_no",
              "value": 0,
              "spellcheck": false
            }
          ],
          "output": "abstract_syntax",
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Argument"] = function(block) {
        const code =
            "new ConceptualEditor.Argument("+
            Blockly.JavaScript.quote_(""+block.getFieldValue("arg_no"))+
            ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.InstanceOf'] = {
      init: function() {
        this.jsonInit({
          "message0": 'instance of %1',
          "args0": [
            {
              "type": "field_wn_synset"
            }
          ],
          "output": "Boolean",
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
})();

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
				gfwordnet.grammar_call("command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(tree),bind(extract_linearization,this));
			}
			
			state.update_ui();
		}
	}
	gfwordnet.grammar_call("command=c-parseToChart&limit=1&from="+gfwordnet.selection.current+"&input="+encodeURIComponent(sentence),extract_parse);
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
		gfwordnet.grammar_call("command=c-linearize&to="+gfwordnet.selection.current+"&tree="+encodeURIComponent(tree),bind(extract_linearization,info));
	}
}
dg_grammarian.resize_blockly_workspace = function(blocklyDiv) {
    // Compute the absolute coordinates and dimensions of blocklyArea.
    const rect = blocklyDiv.getBoundingClientRect();
    blocklyDiv.style.width  = (window.innerWidth-rect.left-50)+'px';
    blocklyDiv.style.height = (window.innerHeight-rect.top-50)+'px';
    Blockly.svgResize(dg_grammarian.workspace);
}
dg_grammarian.load_phrases = function(url, phrases, from, blocklyDiv, toolbox) {
    function onresize(e) {
        dg_grammarian.resize_blockly_workspace(blocklyDiv);
    };
    window.addEventListener('resize', onresize, false);

    function init_phrases() {
        clear(phrases);
        const sentences = dg_grammarian.editor.getSentences();
        for (let i = 0; i < sentences.length; i++) {
            const cell = td([]);
            cell.addEventListener("click", function(e) {
                    dg_grammarian.onclick_sentence(this.parentNode, sentences[i]);
                });
            const context = new ChoiceContext(dg_grammarian.editor);
            dg_grammarian.linearize_ui(sentences[i].getDesciption(context),cell);
            phrases.appendChild(tr(cell));
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

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200 && this.responseXML != null) {
            dg_grammarian.workspace =
                Blockly.inject(blocklyDiv,
                    {toolbox: toolbox
                    ,theme: {startHats: true}
                    ,scrollbars: true
                    });

            const dom = Blockly.Xml.textToDom(this.responseText);
            Blockly.Xml.domToWorkspace(dom, dg_grammarian.workspace);

            dg_grammarian.editor = new ConceptualEditor();
            eval(Blockly.JavaScript.workspaceToCode(dg_grammarian.workspace));
            init_phrases();
        }
    };
    xhttp.open("GET", url, true);
    xhttp.send();
}
dg_grammarian.regenerate = function(update_lin,update_choices) {
	var linearization = element('linearization');
	var choices = element('choices');

	var expr = this.sentence.getAbstractSyntax(this.context);

	if (update_lin) {
		function extract_linearization(lins) {
			const table = gfwordnet.build_alignment_table(lins);
			clear(linearization);
			linearization.appendChild(table);
		}
		gfwordnet.grammar_call("command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(expr),extract_linearization);
	}

	if (update_choices) {
		clear(choices);
		for (var i in this.context.choices) {
			const choice = this.context.choices[i];
			const desc   = choice.getNode().getDescription(new ChoiceContext(dg_grammarian.editor));
			let edit   = null;
			let cell   = null;

			if (choice.getNode() instanceof ConceptualEditor.Boolean) {
				edit = node("input", {type: "checkbox", onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				if (desc != null) {
					edit = node("label", {}, [edit]);
					cell = edit;
				}
			} else if (choice.getNode() instanceof ConceptualEditor.Lexicon) {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				edit.addEventListener("mousedown", this.ontoggle_lexicon_search);

				var items       = choice.getOptions();
				var options     = {}
				var lexical_ids = ""
				for (var j = 0; j < items.length; j++) {
					var lemma  = items[j].getDescription(new ChoiceContext(dg_grammarian.editor));
					
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
				gfwordnet.sense_call("lexical_ids="+encodeURIComponent(lexical_ids),bind(extract_senses,options));

				edit = div_class("lexicon-select", [edit]);
			} else if (choice.getNode() instanceof ConceptualEditor.Numeral) {
				cell = td([]);
				choices.appendChild(tr(cell));

				let min = choice.getNode().min;
				if (min == null)
					min = 1;

				let max = choice.getNode().max;
				if (max == null)
					max = 100;

				edit = node("table", {style: "width: 100%"}, []);

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

				var items = choice.getOptions();
				for (let j = 0; j < items.length; j++) {
					const item_desc = items[j].getDescription(new ChoiceContext(dg_grammarian.editor));

					const option = node("option", {value: j}, []);
					dg_grammarian.linearize_ui(item_desc,option);
					if (j == choice.getChoice())
						option.selected = true;
					edit.appendChild(option);
				}
			}

			if (desc != null) {
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
dg_grammarian.onclick_sentence = function(row,sentence) {
    if (dg_grammarian.edit_mode) {
        this.context  = new ChoiceContext(dg_grammarian.editor);
        this.sentence = sentence;
        this.regenerate(true,true);

        const items = document.getElementsByClassName("current");
        while (items.length > 0) {
            items[0].classList.remove("current");
        }
        row.classList.add("current");
    } else {
        const block =
            dg_grammarian.workspace.getBlockById(sentence.id);
        // Scroll the workspace so that the block's top left corner
        // is in the (0.5; 0.5) part of the viewport.
        const xy = block.getRelativeToSurfaceXY();	    
        const m = dg_grammarian.workspace.getMetrics();
        dg_grammarian.workspace.scrollbar.set(
            xy.x * dg_grammarian.workspace.scale - m.contentLeft + m.viewWidth*0.5,
            xy.y * dg_grammarian.workspace.scale - m.contentTop + m.viewHeight*0.5);
    }
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

dg_grammarian.onedit_rules = function(editBtn, linearization, choices, blocklyDiv) {
    if (dg_grammarian.edit_mode) {
        dg_grammarian.edit_mode = false;
        editBtn.value = "Done";
        clear(linearization);
        clear(choices);
        const items = document.getElementsByClassName("current");
        while (items.length > 0) {
            items[0].classList.remove("current");
        }
        blocklyDiv.style.display = "block";
        dg_grammarian.resize_blockly_workspace(blocklyDiv);
    } else {
        dg_grammarian.editor.reset();
        eval(Blockly.JavaScript.workspaceToCode(dg_grammarian.workspace));
        dg_grammarian.edit_mode = true;
        editBtn.value = "Edit";
        blocklyDiv.style.display = "none";
    }
}
