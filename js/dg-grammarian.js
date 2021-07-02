dg_grammarian = {};

(function(){
	dg_grammarian.context   = null;
	dg_grammarian.sentence  = null;
	dg_grammarian.editor    = null;
    dg_grammarian.edit_mode = true;
	dg_grammarian.lin_cache = null;

    Blockly.HSV_SATURATION = 0.77;
    Blockly.HSV_VALUE      = 0.93;

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

    const dg_abstract_syntax_mutator = {
        mutationToDom: function() {
            if (this.xml_template == null)
                return null;

            const container = document.createElement('mutation');
            for (let check of this.outputConnection.getCheck()) {
                if (check != "abstract_syntax") {
                    container.setAttribute("type",check);
                    break;
                }
            }
            container.appendChild(this.xml_template.cloneNode(true));
            return container;
        },
        clearAllInputs: function() {
            while (this.inputList.length > 0) {
                if (this.inputList[0].connection != null) {
                    const target = this.inputList[0].connection.targetBlock();
                    if (target != null) {
                        target.dispose();
                    }
                }
                this.removeInput(this.inputList[0].name);
            }
        },
        domToMutation: function(container) {
            var str = "";
            var block = this;
            function applyMutation(e,d) {
                if (e.tagName == "function") {
                    if (d > 0 && e.childNodes.length > 0) str += "(";
                    str += e.getAttribute("name");
                    for (let i = 0; i < e.childNodes.length; i++) {
                        str += " ";
                        applyMutation(e.childNodes[i],1);
                    }
                    if (d > 0 && e.childNodes.length > 0) str += ")";
                } else if (e.tagName == "argument") {
                    const no = e.getAttribute("no");
                    const type = e.getAttribute("type");

                    const inp = block.appendValueInput("arg "+no);
                    inp.connection.setCheck(type);

                    if (str != "") {
                        const field = new Blockly.FieldLabel(str);
                        field.maxDisplayLength = 1000;
                        inp.appendField(field);

                        str = "";
                    }
                } else if (e.tagName == "string") {
                    str += JSON.stringify(e.textContent);
                }
            }
            applyMutation(container.firstChild,0);
            if (str != "") {
                const field = new Blockly.FieldLabel(str);
                field.maxDisplayLength = 1000;
                block.appendDummyInput().appendField(field);
            }

            const type = container.getAttribute("type");
            if (type != null)
                this.outputConnection.setCheck([type,"abstract_syntax"]);

            this.xml_template = container.firstChild.cloneNode(true);
        }
    };
    const dg_abstract_syntax_mutator_helper = function() {
      this.setMutator(new dg_grammarian.AbstractSyntaxEditor());
    };
    Blockly.Extensions.registerMutator(
        "dg_abstract_syntax_mutator",
        dg_abstract_syntax_mutator,
        dg_abstract_syntax_mutator_helper);

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
          "output": "abstract_syntax",
          "inputsInline": true,
          "colour": 200,
          "mutator": "dg_abstract_syntax_mutator",
          "tooltip": "Generates a new phrase from zero or more arguments"
        });
      },
      hasLexicalFunction: function() {
        return (this.xml_template != null &&
                this.xml_template.tagName == "function" &&
                this.xml_template.childNodes.length == 0);

      }
    };
    Blockly.JavaScript["ConceptualEditor.Function"] = function(block) {
        function generate(e) {
            if (e.tagName == "function") {
                let code = "new ConceptualEditor.Function(";
                code += Blockly.JavaScript.quote_(e.getAttribute("name"));
                for (let i = 0; i < e.childNodes.length; i++) {
                    code += ", "+generate(e.childNodes[i]);
                }
                code += ")";
                return code;
            } else if (e.tagName == "argument") {
                const no = e.getAttribute("no");
                return Blockly.JavaScript.valueToCode(block, 'arg '+no, Blockly.JavaScript.ORDER_NONE);
            } else if (e.tagName == "string") {
                return "new ConceptualEditor.String("+Blockly.JavaScript.quote_(e.textContent)+")";
            }
        };

        var code = generate(this.xml_template);
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
              "check": "item"
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
          "output": null,
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
              "check": "item"
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
          "output": null,
          "colour": 230,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Lexicon"] = function(block) {
        let code =
            "new ConceptualEditor.Lexicon(";

        code += Blockly.JavaScript.quote_(block.id)+",";

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
          "output": null,
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
          "output": ["abstract_syntax", "Numeral"],
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
              "check": null
            }
          ],
          "mutator": "dg_desc_mutator",
          "previousStatement": "item",
          "nextStatement": "item",
          "colour": 230,
          "tooltip": "Defines an alternative in a list of options",
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

    Blockly.Blocks['ConceptualEditor.Idiom'] = {
      init: function() {
        this.jsonInit({
          "message0": 'Idiom %1',
          "args0": [
            {
              "type": "input_value",
              "name": "of",
              "check": null
            }
          ],
          "message1": '%1 %2',
          "args1": [
            {
              "type": "field_dropdown",
              "name": "languages",
              "options": [
                  ["Afrikaans", "ParseAfr"],
                  ["Bulgarian", "ParseBul"],
                  ["Catalan",   "ParseCat"],
                  ["Chinese",   "ParseChi"],
                  ["Dutch",     "ParseDut"],
                  ["English",   "ParseEng"],
                  ["Estonian",  "ParseEst"],
                  ["Finnish",   "ParseFin"],
                  ["French",    "ParseFre"],
                  ["German",    "ParseGer"],
                  ["Italian",   "ParseIta"],
                  ["Korean",    "ParseKor"],
                  ["Maltese",   "ParseMlt"],
                  ["Polish",    "ParsePol"],
                  ["Portuguese","ParsePor"],
                  ["Slovenian", "ParseSlv"],
                  ["Somali",    "ParseSom"],
                  ["Spanish",   "ParseSpa"],
                  ["Swahili",   "ParseSwa"],
                  ["Swedish",   "ParseSwe"],
                  ["Thai",      "ParseTha"],
                  ["Turkish",   "ParseTur"]
              ]
            },
            {
              "type": "input_value",
              "name": "of",
              "check": null
            }
          ],
          "output": "abstract_syntax",
          "colour": 300,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };

    const FieldQueryVariable = function(empty_msg, only_scope_vars) {
      this.empty_msg = empty_msg;
      this.only_scope_vars = only_scope_vars;
      FieldQueryVariable.superClass_.constructor.call(this, FieldQueryVariable.dropdownCreate.bind(this));
    };
    Blockly.utils.object.inherits(FieldQueryVariable, Blockly.FieldDropdown);

    FieldQueryVariable.fromJson = function(options) {
      const empty_msg = Blockly.utils.replaceMessageReferences(options['empty_msg']);
      const only_scope_vars = Blockly.utils.replaceMessageReferences(options['only_scope_vars']);
      return new FieldQueryVariable(empty_msg, only_scope_vars);
    };

    FieldQueryVariable.variableRegEx = /^[A-Za-z_]\w*$/;

    FieldQueryVariable.prototype.onItemSelected_ = function(menu, menuItem) {
      const id = menuItem.getValue();
      // Handle special cases.
      if (id == "NEW_VARIABLE_ID") {
          const promptAndCheckWithAlert = (text) => {
            Blockly.Variables.promptName(Blockly.Msg['NEW_VARIABLE_TITLE'], text, (varName) => {
                if (varName == null) {
                    return;
                }

                if (!FieldQueryVariable.variableRegEx.test(varName)) {
                    Blockly.alert("\""+varName+"\" is not a valid variable name",
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                if (varName == "NEW_VARIABLE_ID" ||
                    varName == Blockly.RENAME_VARIABLE_ID ||
                    varName == "NEW__CONCEPT_ID") {
                    Blockly.alert("This variable name is reserved",
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                const scope = this.getVariableScope();
                if (scope.indexOf(varName) >= 0) {
                    const msg = Blockly.Msg['VARIABLE_ALREADY_EXISTS'].replace('%1', varName);
                    Blockly.alert(msg,
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                scope.push(varName);
                this.getOptions(false); // forces regeneration of the cache
                this.setValue(varName);
            });
          };

          promptAndCheckWithAlert("");
      } else if (id == Blockly.RENAME_VARIABLE_ID) {
          const oldValue   = this.getValue();
          const promptText =
                Blockly.Msg['RENAME_VARIABLE_TITLE'].replace('%1', oldValue);

          const promptAndCheckWithAlert = (text) => {
            Blockly.Variables.promptName(promptText, text, (varName) => {
                if (varName == null)
                    return;

                if (varName == "") {
                    Blockly.alert("Variable name cannot be empty",
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                if (varName == "NEW_VARIABLE_ID" ||
                    varName == Blockly.RENAME_VARIABLE_ID ||
                    varName == "NEW_CONCEPT_ID") {
                    Blockly.alert("This variable name is reserved",
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                const scope = this.getVariableScope();
                if (scope.indexOf(varName) >= 0) {
                    const msg = Blockly.Msg['VARIABLE_ALREADY_EXISTS'].replace('%1', varName);
                    Blockly.alert(msg,
                      function() {
                        promptAndCheckWithAlert(varName);  // Recurse
                      });
                    return;
                }

                const index = scope.indexOf(oldValue);
                if (index !== -1) {
                    scope[index] = varName;
                }

                if (this.getSourceBlock() != null) {
                    let block = this.getSourceBlock();
                    while (block != null &&
                           block.type != "ConceptualEditor.Query") {
                        const field1 = block.getField("subject");
                        if (field1.getValue() == oldValue) {
                            field1.getOptions(false); // forces regeneration of the cache
                            field1.setValue(varName);
                        }
                        const field2 = block.getField("object");
                        if (field2.getValue() == oldValue) {
                            field2.getOptions(false); // forces regeneration of the cache
                            field2.setValue(varName);
                        }
                        block = block.previousConnection.targetBlock();
                    };

                    block = this.getSourceBlock().nextConnection.targetBlock();
                    while (block != null) {
                        const field1 = block.getField("subject");
                        if (field1.getValue() == oldValue) {
                            field1.getOptions(false); // forces regeneration of the cache
                            field1.setValue(varName);
                        }
                        const field2 = block.getField("object");
                        if (field2.getValue() == oldValue) {
                            field2.getOptions(false); // forces regeneration of the cache
                            field2.setValue(varName);
                        }
                        block = block.nextConnection.targetBlock();
                    };
                }
            });
        };

        promptAndCheckWithAlert('');
      } else if (id == "NEW_CONCEPT_ID") {
          dg_grammarian.show_gloss_search_dialog();
      } else {
        // Handle normal case.
        this.setValue(id);
      }
    }

    FieldQueryVariable.prototype.getQueryBlock = function() {
        if (this.getSourceBlock() != null) {
            if (this.getSourceBlock().type == "ConceptualEditor.Query")
                return this.getSourceBlock();

            let block = this.getSourceBlock().previousConnection.targetBlock();
            while (block != null) {
                if (block.type == "ConceptualEditor.Query")
                    return block;
                block = block.previousConnection.targetBlock();
            };
        }

        return null;
    };

    FieldQueryVariable.prototype.getVariableScope = function() {
        const block = this.getQueryBlock();
        return block ? block.variableScope : null;
    };

    FieldQueryVariable.prototype.getSynsets = function() {
        const block = this.getQueryBlock();
        return block ? block.synsets : null;
    };

    FieldQueryVariable.prototype.getLexiconScope = function() {
        const scope     = [];

        let block = this.getQueryBlock();
        if (block == null)
            return scope;

        if (block.outputConnection.targetConnection == null)
            return scope;

        let input = block.outputConnection.targetConnection.getParentInput();

        block = input.getSourceBlock();
        for (;;) {
            let index = 0;

            const inputList = block.inputList;
            for (let i in inputList) {
                if (inputList[i] == input)
                    break;
                const child = inputList[i].connection.targetBlock();
                if (child != null &&
                    (child.type == "ConceptualEditor.Lexicon" ||
                     child.type == "ConceptualEditor.Query")) {
                    scope.splice(index, 0, child); 
                    index++;
                }
            }

            if (block.outputConnection != null &&
                block.outputConnection.targetConnection != null) {
                input = block.outputConnection.targetConnection.getParentInput();
                block = input.getSourceBlock();
            } else {
                break;
            }
        }

        return scope;
    };

    FieldQueryVariable.dropdownCreate = function() {
        const scope   = this.getVariableScope();
        const synsets = this.getSynsets();
        const options = [];

        if (scope == null) {
            options.push([this.empty_msg, ""]);
        } else {
            for (let varName of scope) {
                options.push([varName, varName]);
            }

            if (scope.length == 0) {
                options.push([this.empty_msg, ""]);
            }

            if (!this.only_scope_vars) {
                options.push([Blockly.Msg["NEW_VARIABLE"], "NEW_VARIABLE_ID"]);

                if (FieldQueryVariable.variableRegEx.test(this.getValue())) {
                    options.push([Blockly.Msg["RENAME_VARIABLE"], Blockly.RENAME_VARIABLE_ID]);
                }
            }
        }

        if (!this.only_scope_vars) {
            const lex_scope = this.getLexiconScope();
            for (let i in lex_scope) {
                options.push(["Use Choice "+(parseInt(i)+1), lex_scope[i].id]);
            }

            if (synsets != null) {
                for (let synset of synsets) {
                    options.push(["Concept "+synset, synset]);
                }
            }

            options.push(["Select New Concept", "NEW_CONCEPT_ID"]);
        }

        return options;
    };

    Blockly.fieldRegistry.register('field_query_variable', FieldQueryVariable);

    Blockly.Blocks['ConceptualEditor.Query'] = {
      init: function() {
        this.jsonInit({
          "message0": "find %1",
          "args0": [
            {
              "type": "field_query_variable",
              "name": "result",
              "empty_msg": "<no result>",
              "only_scope_vars": true
            }
          ],
          "message1": "if %1",
          "args1": [
            {
              "type": "input_statement",
              "name": "pattern",
              "check": "triple"
            }
          ],
          "message2": "ui %1",
          "args2": [
            {
              "type":  "input_value",
              "name":  "desc",
              "check": "abstract_syntax"
            }
          ],
          "output": null,
          "colour": 190,
          "tooltip": "Looks up a related expression in the lexicon",
        });

        this.variableScope = [];
        this.synsets       = [];
      }
    };
    Blockly.JavaScript["ConceptualEditor.Query"] = function(block) {
        let code =
            "new ConceptualEditor.Query(";

        code += Blockly.JavaScript.quote_(block.id);
        code += ",";
        code += Blockly.JavaScript.quote_(block.getFieldValue("result"));

        code += ",";
        if (block.getInput("desc").connection.targetBlock() != null) {
            code += Blockly.JavaScript.valueToCode(block, 'desc', Blockly.JavaScript.ORDER_NONE);
        } else {
            code += "null";
        }

        code += ",";
        code += sequenceToCode(block, "pattern");

        code += ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };

    Blockly.Blocks['ConceptualEditor.Triple'] = {
      init: function() {
        this.jsonInit({
          "message0": '%1 %2 %3',
          "args0": [
            {
              "type": "field_query_variable",
              "name": "subject",
              "empty_msg": "<no subject>"
            },
            {
              "type": "field_dropdown",
              "name": "predicate",
              "options": [
                  ["Antonym", "Antonym"],
                  ["Hypernym", "Hypernym"],
                  ["Instance Hypernym", "InstanceHypernym"],
                  ["Hyponym", "Hyponym"],
                  ["Instance Hyponym", "InstanceHyponym"],
                  ["Member Holonym", "Holonym Member"],
                  ["Substance Holonym", "Holonym Substance"],
                  ["Part Holonym", "Holonym Part"],
                  ["Member Meronym", "Meronym Member"],
                  ["Substance Meronym", "Meronym Substance"],
                  ["Part Meronym", "Meronym Part"],
                  ["Attribute", "Attribute"],
                  ["Domain of Topic Synset", "DomainOfSynset Topic"],
                  ["Domain of Region Synset", "DomainOfSynset Region"],
                  ["Domain of Usage Synset", "DomainOfSynset Usage"],
                  ["Member of Topic Domain", "MemberOfDomain Topic"],
                  ["Member of Region Domain", "MemberOfDomain Region"],
                  ["Member of Usage Domain", "MemberOfDomain Usage"],
                  ["Entailment", "Entailment"],
                  ["Cause", "Cause"],
                  ["AlsoSee", "AlsoSee"],
                  ["VerbGroup", "VerbGroup"],
                  ["SimilarTo", "SimilarTo"],
                  ["Derived", "Derived"],
                  ["Participle", "Participle"]
              ]
            },
            {
              "type": "field_query_variable",
              "name": "object",
              "empty_msg": "<no object>"
            }
          ],
          "previousStatement": "triple",
          "nextStatement": "triple",
          "colour": 190,
          "tooltip": "Represents a relation in the lexicon",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Triple"] = function(block) {
        let code = "[";
        code += Blockly.JavaScript.quote_(block.getFieldValue("subject"));
        code += ",";
        code += Blockly.JavaScript.quote_(block.getFieldValue("predicate"));
        code += ",";
        code += Blockly.JavaScript.quote_(block.getFieldValue("object"));
        code += "]";
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
          "output": null,
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
              "name": "no",
              "value": 0,
              "spellcheck": false
            }
          ],
          "output": null,
          "colour": 100,
          "tooltip": "Checks for an instance of a given WordNet class",
        });
      }
    };
    Blockly.JavaScript["ConceptualEditor.Argument"] = function(block) {
        const code =
            "new ConceptualEditor.Argument("+
            Blockly.JavaScript.quote_(""+block.getFieldValue("no"))+
            ")";
        return [code, Blockly.JavaScript.ORDER_NONE];
    };
})();

dg_grammarian.AbstractSyntaxEditor = function(quarkNames) {
  dg_grammarian.AbstractSyntaxEditor.superClass_.constructor.call(this, quarkNames);
};
Blockly.utils.object.inherits(dg_grammarian.AbstractSyntaxEditor, Blockly.Mutator);

dg_grammarian.AbstractSyntaxEditor.prototype.setVisible = function(visible) {
    let search = this.getSearchPopup();

    if (visible == (search != null)) {
        // No change.
        return;
    }
    Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BUBBLE_OPEN))(
                                this.block_, visible, 'mutator'));
    if (visible) {
        const doneBtn  = node("input", {type: "button", style: "float: right", value: "Done"}, []);
        const cancelBtn  = node("input", {type: "button", style: "float: right", value: "Cancel"}, []);
        const container = node("div", {}, []);

        const row = [];

        const parseTab =
          node("h1",{class: "selected"},[text("Parse")]);
        parseTab.addEventListener("click", (e) =>
                this.onclick_tab(parseTab,container,doneBtn));
        row.push(td(parseTab));

        if (this.block_.xml_template == null ||
            this.block_.hasLexicalFunction()) {
            const lexiconTab =
              node("h1",{class: "unselected"},[text("Lexicon")]);
            lexiconTab.addEventListener("click", (e) =>
                    this.onclick_tab(lexiconTab,container,doneBtn));
            row.push(td(lexiconTab));
        }

        if (this.block_.hasLexicalFunction()) {
            const relateTab =
              node("h1",{class: "unselected"},[text("Relate")]);
            relateTab.addEventListener("click", (e) =>
                    this.onclick_tab(relateTab,container,doneBtn));
            row.push(td(relateTab));
        }

        row.push(td(cancelBtn));
        row.push(td(doneBtn));

        const tabs =
          node("table",{class: "header-tabs"},[tr(row)]);

        this.init_parse_tab(container, doneBtn);

        search = div_class("wn_search",[tabs,container]);

        doneBtn.disabled = true;
        doneBtn.addEventListener("click", (e) => {
                const tab = tabs.querySelector(".selected");
                this.done(search, tab, container);
            });
        cancelBtn.addEventListener("click", (e) => {
                document.body.removeChild(search);
            });
        document.body.appendChild(search);
    } else {
        search.parentNode.removeChild(search);
    }
}
dg_grammarian.AbstractSyntaxEditor.prototype.onclick_tab = function (tab,container,doneBtn) {
	var tr = tab.parentNode.parentNode;
	var td = tr.firstChild;
	while (td != null) {
		if (td.firstChild == tab) {
			td.firstChild.className = "selected";
		} else if (td.firstChild.className == "selected") {
			td.firstChild.className = "unselected";
		}
		td = td.nextSibling;
	}

    this.init(tab,container,doneBtn);
}
dg_grammarian.AbstractSyntaxEditor.prototype.init = function (tab,container,doneBtn) {
    doneBtn.disabled = true;
	if (tab.innerHTML == "Parse") {
		this.init_parse_tab(container,doneBtn);
	} else if (tab.innerHTML == "Lexicon") {
		this.init_lexicon_tab(container,doneBtn);
	} else if (tab.innerHTML == "Relate") {
		this.init_relate_tab(container,doneBtn);
	}
}
dg_grammarian.AbstractSyntaxEditor.prototype.init_parse_tab = function (container,doneBtn) {
    clear(container);

    gfwordnet.selection = getMultiSelection(element('from'));

    const edt = node("input", {type: "text", placeholder: "Enter a phrase to parse", spellcheck: "false", style: "width: 50em"}, []);
    const parseBtn = node("input", {type: "button", value: "Parse"}, []);
    const linearization = node("td", {colspan: 2}, []);
    const table = node("table", {}, [tr([td(edt),td(parseBtn)])
                                    ,tr(linearization)]);

    edt.addEventListener("keyup", function(event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            parseBtn.click();
        }
    });
    parseBtn.addEventListener("click", (e) => {
        this.parse(edt.value, linearization);
        doneBtn.disabled = false;
    });

    container.appendChild(table);
}
dg_grammarian.AbstractSyntaxEditor.prototype.init_lexicon_tab = function (container,doneBtn) {
    clear(container);

    doneBtn.disabled = false;

    gfwordnet.selection = null;
    gfwordnet.can_select = true;

    const edt = node("input", {type: "text", placeholder: "Search for a word", spellcheck: "false"}, []);
    const searchBtn = node("input", {type: "button", value: "Search"}, []);
    const table1 = node("table", {}, [tr([td(edt),td(searchBtn)])]);
    container.appendChild(table1);

    container.appendChild(node("br", {}, []));

    const domains = node("table", {class: "selectors"}, [
                      node("thead", {}, []),
                      node("tbody", {}, [])
                    ]);
    const result = node("table", {class: "result"},  [
                      node("thead", {}, []),
                      node("tbody", {}, []),
                      node("tfoot", {}, [])
                    ]);
    const divElem = node("div", {style: "min-height: 85%"}, [domains,result]);
    container.appendChild(divElem);

    edt.addEventListener("keyup", function(event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            searchBtn.click();
        }
    });
    searchBtn.addEventListener("click", (e) => {
        gfwordnet.search(getMultiSelection(element('from')), edt.value, domains, result, null);
        edt.value = "";
        doneBtn.disabled = false;
    });

    const lemmas = [];
    let   lexical_ids = "";

    let itemBlock = this.block_.outputConnection.targetBlock();
    if (itemBlock != null && itemBlock.type == "ConceptualEditor.Item") {
        for (;;) {
            const prevBlock = itemBlock.previousConnection.targetBlock();
            if (prevBlock == null || prevBlock.type != "ConceptualEditor.Item")
                break;
            itemBlock = prevBlock;
        }

        while (itemBlock != null) {
            const funBlock = itemBlock.getInput("of").connection.targetBlock();
            if (funBlock != null &&
                funBlock.type == "ConceptualEditor.Function" &&
                funBlock.hasLexicalFunction()) {
                const lex_id = funBlock.xml_template.getAttribute("name");
                lexical_ids = lexical_ids+" "+lex_id;
                lemmas.push({lemma: lex_id, prob: 0});
            }
            itemBlock = itemBlock.nextConnection.targetBlock();
        }
    } else if (this.block_.xml_template != null) {
        const lex_id = this.block_.xml_template.getAttribute("name");
        lexical_ids = lex_id;
        lemmas.push({lemma: lex_id, prob: 0});
    }

    if (lemmas.length == 0)
        return;

    gfwordnet.selection = getMultiSelection(element('from'));

    const rows =
        gfwordnet.render_rows(result,gfwordnet.selection,true,lemmas);

    function helper(senses) {
        const result_tfoot  = result.getElementsByTagName("TFOOT")[0];
        const domains_tbody = domains.getElementsByTagName("TBODY")[0];
        const ctxt = {rows: rows, domains_map: {}};

        for (var i in senses.result) {
            gfwordnet.render_sense_rows(ctxt,result_tfoot,domains_tbody,senses.result[i].lex_ids);
        }

        gfwordnet.selection.lex_ids = gfwordnet.lex_ids;
        gfwordnet.lex_ids = {};

        let tr = result_tfoot.firstElementChild;
        while (tr != null) {
            gfwordnet.mangle_row_as_selected(tr);
            tr = tr.nextElementSibling;
        }

        gfwordnet.insert_selection_header(result_tfoot);
    }
    gfwordnet.sense_call("lexical_ids="+encodeURIComponent(lexical_ids),helper);
}
dg_grammarian.AbstractSyntaxEditor.prototype.init_relate_tab = function (container,doneBtn) {
    clear(container);

    gfwordnet.selection = getMultiSelection(element('from'));

    const tree = node("ul", {}, []);

    function build_tree(sense_id, graph) {
        const subtree = node("ul", {class: "pointers"}, []);
        for (let i in graph[sense_id].ptrs) {
            const ptr = graph[sense_id].ptrs[i];
            const checkbox = node("input",{type: "checkbox"},[]);
            checkbox.addEventListener("click", function(e) {
                doneBtn.disabled = true;
                for (let checkbox of container.querySelectorAll("input[type=checkbox]")) {
                    if (checkbox.checked) {
                        doneBtn.disabled = false;
                        break;
                    }
                }
            });
            checkbox.dataset.predicate = ptr[0];
            checkbox.dataset.object = ptr[1];
            const li = node("li",{},[text(graph[ptr[1]].gloss), text("\u00A0"), checkbox]);
            subtree.appendChild(node("li",{},[text(ptr[0]),node("ul", {}, [li])]));
        }
        return node("li",{},[text(graph[sense_id].gloss), text("\u00A0"), subtree]);
    }

    function extract_glosses(res) {
        clear(tree);
        for (let i in res.synsets) {
            tree.appendChild(build_tree(res.synsets[i], res.graph));
        }
    }

    const lex_id = this.block_.xml_template.getAttribute("name");
    gfwordnet.sense_call("context_id="+encodeURIComponent(lex_id)+"&depth=1",extract_glosses);
    container.appendChild(tree);
}
dg_grammarian.AbstractSyntaxEditor.prototype.done = function (search,tab,container) {
	if (tab.innerHTML == "Parse") {
		this.done_parse_tab(search,container);
	} else if (tab.innerHTML == "Lexicon") {
		this.done_lexicon_tab(search,container);
	} else if (tab.innerHTML == "Relate") {
		this.done_relate_tab(search,container);
	}
}
dg_grammarian.AbstractSyntaxEditor.prototype.done_parse_tab = function(search,container)  {       
    if (this.state != null) {
        const xmlDoc = document.implementation.createDocument(null,null);
        const mutElem = xmlDoc.createElement("mutation");
        const children = [];
        this.block_.xml_template =
            this.state.createXmlTemplateAndChildren(xmlDoc,Blockly.getMainWorkspace(),children,this.state.root);
        mutElem.appendChild(this.block_.xml_template.cloneNode(true));
        mutElem.setAttribute("type", this.state.chart[this.state.root].cat);

        this.block_.clearAllInputs();
        this.block_.domToMutation(mutElem);
        for (let sub of children) {
            const input = this.block_.getInput('arg '+sub[0]);
            input.connection.connect(sub[1].outputConnection);
        }

        document.body.removeChild(search);
    }
}
dg_grammarian.AbstractSyntaxEditor.prototype.done_lexicon_tab = function(search,container) {
    if (gfwordnet.selection.concepts != null) {
        const targetConnection = this.block_.outputConnection.targetConnection;

        this.block_.dispose();

        const queryBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Query");
        queryBlock.initSvg();
        queryBlock.render();

        queryBlock.variableScope.push("X");
        queryBlock.getField("result").getOptions(false); // forces regeneration of the cache
        queryBlock.getField("result").setValue("X");

        if (targetConnection != null)
            queryBlock.outputConnection.connect(targetConnection);

        let connection = queryBlock.getInput("pattern").connection;
        for (let x of gfwordnet.selection.concepts) {
            const synset = ""+x;
            if (!(synset in queryBlock.synsets))
                queryBlock.synsets.push(synset);

            const tripleBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Triple");
            tripleBlock.initSvg();
            tripleBlock.render();

            connection.connect(tripleBlock.previousConnection);
            connection = tripleBlock.nextConnection;

            tripleBlock.getField("subject").getOptions(false); // forces regeneration of the cache
            tripleBlock.getField("subject").setValue("X");
            tripleBlock.getField("predicate").setValue("InstanceHypernym");
            tripleBlock.getField("object").getOptions(false); // forces regeneration of the cache
            tripleBlock.getField("object").setValue(synset);
        }
    } else {
        const keys = [];
        for (let lex_id in gfwordnet.selection.lex_ids) {
            if (gfwordnet.selection.lex_ids[lex_id].match)
                keys.push(lex_id);
        }

        let itemBlock = this.block_.outputConnection.targetBlock();
        if (itemBlock != null && itemBlock.type == "ConceptualEditor.Item") {
            for (;;) {
                const prevBlock = itemBlock.previousConnection.targetBlock();
                if (prevBlock == null || prevBlock.type != "ConceptualEditor.Item")
                    break;
                itemBlock = prevBlock;
            }

            let connection = null;
            while (itemBlock != null) {
                connection = itemBlock.nextConnection;

                const funBlock = itemBlock.getInput("of").connection.targetBlock();
                if (funBlock != null &&
                    funBlock.type == "ConceptualEditor.Function" &&
                    funBlock.hasLexicalFunction()) {
                    const lex_id = funBlock.xml_template.getAttribute("name");
                    const index = keys.indexOf(lex_id);

                    if (index >= 0) {
                        keys.splice(index,1);
                        itemBlock = connection.targetBlock();
                    } else {
                        const prevBlock = itemBlock.previousConnection.targetBlock();
                        const nextBlock = connection.targetBlock();
                        connection.disconnect();
                        itemBlock.dispose();
                        if (prevBlock.type == "ConceptualEditor.Item")
                            prevBlock.nextConnection.connect(nextBlock.previousConnection);
                        else
                            prevBlock.getInput("do").connection.connect(nextBlock.previousConnection);
                        itemBlock = nextBlock;
                    }
                } else {
                    itemBlock = connection.targetBlock();
                }
            }

            const xmlDoc = document.implementation.createDocument(null,null);

            for (let lex_id of keys) {
                const itemBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Item");
                itemBlock.initSvg();
                itemBlock.render();

                const funBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Function");
                funBlock.initSvg();
                funBlock.render();

                const mutElem = xmlDoc.createElement("mutation");
                const funElem = xmlDoc.createElement("function");
                mutElem.appendChild(funElem);
                funElem.setAttribute("name", lex_id);
                mutElem.setAttribute("type", this.block_.output);
                funBlock.domToMutation(mutElem);
                funBlock.xml_template = funElem;

                itemBlock.getInput("of").connection.connect(funBlock.outputConnection);
                connection.connect(itemBlock.previousConnection);
                connection = itemBlock.nextConnection;
            }
        } else {
            if (keys.length == 0) {
                this.block_.dispose();
            } else if (keys.length == 1) {
                const lex_id = keys[0];

                this.block_.xml_template.setAttribute("name", lex_id);

                const xmlDoc = document.implementation.createDocument(null,null);
                const mutElem = xmlDoc.createElement("mutation");
                mutElem.appendChild(this.block_.xml_template.cloneNode(true));
                mutElem.setAttribute("type", this.block_.output);
                this.block_.clearAllInputs();
                this.block_.domToMutation(mutElem);

                document.body.removeChild(search);
            } else {
                const lexiconBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Lexicon");
                lexiconBlock.initSvg();
                lexiconBlock.render();

                const xmlDoc = document.implementation.createDocument(null,null);

                let connection = lexiconBlock.getInput("do").connection;
                for (let lex_id of keys) {
                    const itemBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Item");
                    itemBlock.initSvg();
                    itemBlock.render();

                    const funBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Function");
                    funBlock.initSvg();
                    funBlock.render();

                    const mutElem = xmlDoc.createElement("mutation");
                    const funElem = xmlDoc.createElement("function");
                    mutElem.appendChild(funElem);
                    funElem.setAttribute("name", lex_id);
                    mutElem.setAttribute("type", this.block_.output);
                    funBlock.domToMutation(mutElem);
                    funBlock.xml_template = funElem;

                    itemBlock.getInput("of").connection.connect(funBlock.outputConnection);
                    connection.connect(itemBlock.previousConnection);
                    connection = itemBlock.nextConnection;
                }

                const targetConnection = this.block_.outputConnection.targetConnection;

                this.block_.dispose();

                if (targetConnection != null)
                    targetConnection.connect(lexiconBlock.outputConnection);
            }
        }
    }
}
dg_grammarian.AbstractSyntaxEditor.prototype.done_relate_tab = function(search,container)  {
    const targetConnection = this.block_.outputConnection.targetConnection;

    this.block_.dispose();

    const queryBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Query");
    queryBlock.initSvg();
    queryBlock.render();

    queryBlock.variableScope.push("X");
    queryBlock.getField("result").getOptions(false); // forces regeneration of the cache
    queryBlock.getField("result").setValue("X");

    if (targetConnection != null)
        targetConnection.connect(queryBlock.outputConnection);

    let connection = queryBlock.getInput("pattern").connection;
    for (let checkbox of container.querySelectorAll("input[type=checkbox]")) {
        if (checkbox.checked &&
            checkbox.dataset.predicate != null && checkbox.dataset.object != null) {
            if (!(checkbox.dataset.object in queryBlock.synsets))
                queryBlock.synsets.push(checkbox.dataset.object);

            const tripleBlock = Blockly.getMainWorkspace().newBlock("ConceptualEditor.Triple");
            tripleBlock.initSvg();
            tripleBlock.render();

            connection.connect(tripleBlock.previousConnection);
            connection = tripleBlock.nextConnection;

            tripleBlock.getField("subject").getOptions(false); // forces regeneration of the cache
            tripleBlock.getField("subject").setValue("X");
            tripleBlock.getField("predicate").setValue(checkbox.dataset.predicate);
            tripleBlock.getField("object").getOptions(false); // forces regeneration of the cache
            tripleBlock.getField("object").setValue(checkbox.dataset.object);
        }
    }
}
dg_grammarian.AbstractSyntaxEditor.prototype.isVisible = function() {
    return this.getSearchPopup() != null;
};
Blockly.Icon.prototype.setIconLocation=function(a){
    this.iconXY_=a;
};
Blockly.Icon.prototype.applyColour=function(a){
};
dg_grammarian.AbstractSyntaxEditor.prototype.getSearchPopup = function() {
    const items = document.getElementsByClassName("wn_search");
    if (items && items.length > 0) {
        return items[0];
    }
    return null;
};
dg_grammarian.AbstractSyntaxEditor.prototype.parse = function (sentence, linearization) {
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
	function select_bracket(table,colspan,fid,lex_id,frames) {
		gfwordnet.select_bracket(table,colspan,fid,lex_id,frames);

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
        const td_cell  = phrase.parentNode;
        const table    = td_cell.parentNode.parentNode;
        const selected = table.querySelector("div.syntax.selected_bracket");

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

        let selected_fid = null;
		let brackets = [];
		for (let fid in state.chart) {
			let info = state.chart[fid];
			if (info.traverse_fid != null) {
				for (let bracket of info.brackets) {
					if (bracket.start <= start && bracket.end >= end) {
						brackets.push(bracket);

                        if (selected && selected.dataset.fid == info.traverse_fid) {
                            selected_fid = bracket.fid;
                        }
					}
				}
			}
		}

		let best = null;
        if (brackets.length > 0) {
            brackets.sort(function (a, b) {
                let res = (a.end-a.start) - (b.end-b.start);
                if (res == 0)
                    res = state.chart[a.fid].traverse_fid - state.chart[b.fid].traverse_fid;
                return res;
            });

			best = brackets[0];
            if (selected_fid) {
				for (let i in brackets) {
					if (brackets[i].fid > selected_fid) {
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

		bind(select_bracket,state)(table,state.offsets.length,traverse_fid,lex_id,[]);
	}
	function extract_linearization(lins) {
		const table =
			gfwordnet.build_alignment_table(lins,[],
			                                this.offsets.length,
			                                gfwordnet.selection.current,
			                                bind(select_bracket,this),
                                            true);

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

		if (!("roots" in result[0])) {
			return;
		}

		let roots = result[0].roots;
		let chart = result[0].chart;

		result[0].current = 0;
		for (let i in roots) {
			this.state = { offsets: []
				         , fids: {}
				         , levels: [[roots[i]]]
				         , root: roots[i]
				         , chart: chart
				         , traverse_fid: 0
				         };

			// collect the offsets and initialize the current fields
			collect_info(this.state.root,this.state);
			if (this.state.offsets.length > 0) {
				// build sorted list with unique offsets
				this.state.offsets.sort(function (a, b) { return a - b; });
				var uniques = [this.state.offsets[0]];
				for (let i = 1; i < this.state.offsets.length; i++) {
					if (this.state.offsets[i-1] !== this.state.offsets[i]) {
						uniques.push(this.state.offsets[i]);
					}
				}
				this.state.offsets = uniques
			}

			this.state.colspan = function(i,j) {
				return this.offsets.indexOf(j)-this.offsets.indexOf(i);
			}
			this.state.build_level = function(level,editable) {
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
						const cell = node("div",{class:"syntax"},[text(this.chart[bracket.fid].cat)]);
						if (editable) {
							cell.dataset.fid = this.chart[bracket.fid].traverse_fid;
							cell.addEventListener("mouseenter",(e) => { dg_grammarian.AbstractSyntaxEditor.onmouseenter_bracket(cell, bracket.fid, this); });
							cell.addEventListener("mouseout",(e) => { dg_grammarian.AbstractSyntaxEditor.onmouseout_bracket(cell, this); });
							cell.addEventListener("click",(e) => {
                                const info = this.chart[bracket.fid];
                                const traverse_fid = info.traverse_fid;
                                const lex_id = info.prods[info.current].tree;
                                const table = cell.parentNode.parentNode.parentNode;
                                bind(select_bracket,this)(table,this.offsets.length,traverse_fid,lex_id,[]);
                            });
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
			this.state.getAbstractSyntax = function(fid,level) {
				var info = this.chart[fid];
				if (level+1 >= this.levels.length)
					this.levels.push([])

				const prod = info.prods[info.current];
				let   tree = prod.tree;
				if (prod.args.length > 0) {
					for (let arg of prod.args) {
						const subtree =
						    this.getAbstractSyntax(arg,level+1);
						tree += " "+subtree;
						this.levels[level+1].push(arg);
					}
					tree = "("+tree+")";
				}

				info.traverse_fid = this.traverse_fid++;

				return tree;
			}
			this.state.createXmlTemplateAndChildren = function(xmlDoc,workspace,children,fid) {
				const info = this.chart[fid];
                const prod = info.prods[info.current];

                const funElem = xmlDoc.createElement("function");
                funElem.setAttribute("name", prod.tree);
                for (let arg_fid of prod.args) {
                    if (this.chart[arg_fid].is_argument) {
                        const childElem =
                            xmlDoc.createElement("argument");
                        childElem.setAttribute("no", arg_fid);
                        childElem.setAttribute("type", this.chart[arg_fid].cat);
                        funElem.appendChild(childElem);

                        const subDoc = document.implementation.createDocument(null,null);
                        const mutElem = subDoc.createElement("mutation");
                        const subChildren = [];
                        const subBlock = workspace.newBlock("ConceptualEditor.Function");

                        subBlock.xml_template =
                            this.createXmlTemplateAndChildren(subDoc,workspace,subChildren,arg_fid);
                        mutElem.appendChild(subBlock.xml_template);
                        mutElem.setAttribute("type", this.chart[arg_fid].cat);

                        subBlock.domToMutation(mutElem);
                        for (let sub of subChildren) {
                            const input = subBlock.getInput('arg '+sub[0]);
                            input.connection.connect(sub[1].outputConnection);
                        }

                        subBlock.initSvg();
                        subBlock.render();

                        children.push([arg_fid,subBlock]);
                    } else {
                        const childElem =
                            this.createXmlTemplateAndChildren(xmlDoc,workspace,children,arg_fid);
                        funElem.appendChild(childElem);
                    }
                }

                return funElem;
			}
            this.state.update_ui = function() {
				// initialize the levels and extract an abstract syntax tree
				this.levels.length = 1;
				this.traverse_fid  = 0;
				for (let fid in this.chart) {
					delete this.chart[fid].traverse_fid;
				}
				const tree = this.getAbstractSyntax(this.root,0);
				gfwordnet.grammar_call("command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(tree),bind(extract_linearization,this));
			}

			this.state.update_ui();
		}
	}

    let startCat = null;
    if (this.block_.outputConnection.targetConnection != null) {
        const check =
            dg_grammarian.ConnectionChecker.up(this.block_.outputConnection.targetConnection);
        if (check != null) {
            for (let i in check) {
                if (check[i] != "abstract_syntax") {
                    startCat = check[i];
                    break;
                }
            }
        }
    }
	gfwordnet.grammar_call("command=c-parseToChart&limit=1&from="+gfwordnet.selection.current+"&input="+encodeURIComponent(sentence)+((startCat != null) ? "&cat="+startCat : ""),extract_parse.bind(this));
}
dg_grammarian.AbstractSyntaxEditor.onmouseenter_bracket = function(cell,fid,state) {
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
    gfwordnet.popup = div_class("floating",[]);
    cell.appendChild(gfwordnet.popup);

	if (info.prods.length > 1) {
		const btn = img("edit.png");
		btn.addEventListener("click", function (e) {dg_grammarian.AbstractSyntaxEditor.onclick_edit(cell,fid,state)});
		gfwordnet.popup.appendChild(btn);
	}

    const btn = img(info.is_argument ? "no-argument.png" : "argument.png");
    btn.addEventListener("click", function (e) {dg_grammarian.AbstractSyntaxEditor.onclick_turn_argument(cell,fid,state)});
    gfwordnet.popup.appendChild(btn);
}
dg_grammarian.AbstractSyntaxEditor.onmouseout_bracket = function(cell,state) {
	clear(cell.parentNode.parentNode.firstElementChild);
}
dg_grammarian.AbstractSyntaxEditor.onclick_edit = function(bracket,fid,state) {
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
		edit.addEventListener("change", (e) => { dg_grammarian.AbstractSyntaxEditor.onchange_production(fid,state,i); });
		choice_row.firstElementChild.appendChild(node("label", {}, [edit, text(prod.tree)]));
		table.insertBefore(choice_row,row);
	}
	
	const btn = node("span", {style: "cursor: pointer"}, [text("\u2715")]);
	btn.addEventListener("click", function(e) { state.update_ui(); });
	bracket.appendChild(text("\xA0"));
	bracket.appendChild(btn);

	gfwordnet.popup.parentNode.removeChild(gfwordnet.popup);
    gfwordnet.popup = null;
}
dg_grammarian.AbstractSyntaxEditor.onclick_turn_argument = function(bracket,fid,state) {
	const row   = bracket.parentNode.parentNode;
	const table = row.parentNode;
    const info  = state.chart[fid];

    info.is_argument = !info.is_argument;

    function mark(element,fid) {
		let child = element.firstElementChild;
		while (child != null) {
			if (info.traverse_fid == child.dataset.fid) {
                if (info.is_argument)
                    child.classList.add("argument_bracket");
                else
                    child.classList.remove("argument_bracket");
            }
			mark(child,fid);
			child = child.nextElementSibling;
		}
	}

	mark(table,fid);

   	gfwordnet.popup.parentNode.removeChild(gfwordnet.popup);
    gfwordnet.popup = null;
}
dg_grammarian.AbstractSyntaxEditor.onchange_production = function(fid,state,i) {
	const info = state.chart[fid];
	info.current = i;
	state.update_ui();
}

dg_grammarian.show_gloss_search_dialog = function() {
    const edt = node("input", {type: "text", style: "width: 50em"}, []);
    const searchBtn = node("input", {type: "button", value: "Search"}, []);
    const tree = node("ul", {}, []);
    const table = node("table", {}, [tr([td(edt),td(searchBtn)])
                                    ,tr(node("td", {colspan: 2}, [tree]))]);
    search = div_class("wn_search",[table]);

    function build_tree(sense_id, graph) {
        const subtree = node("ul", {class: "pointers"}, []);
        for (let i in graph[sense_id].ptrs) {
            const li = node("li",{},[text(graph[graph[sense_id].ptrs[i][1]].gloss), text("\u00A0"), node("button",{},[text("\u25BC")])]);
            subtree.appendChild(node("li",{},[text(graph[sense_id].ptrs[i][0]),node("ul", {}, [li])]));
        }
        return node("li",{},[text(graph[sense_id].gloss), text("\u00A0"), node("button",{},[text("\u25BC")]), subtree]);
    }

    function extract_glosses(res) {
        clear(tree);
        tree.appendChild(build_tree(70971, res.graph));
    }

    searchBtn.addEventListener("click", (e) => {
            gfwordnet.sense_call("context_id="+encodeURIComponent(edt.value),extract_glosses);
        });
    document.body.appendChild(search);
}

dg_grammarian.ConnectionChecker = function() {
  dg_grammarian.ConnectionChecker.superClass_.constructor.call(this);
};
Blockly.utils.object.inherits(dg_grammarian.ConnectionChecker, Blockly.ConnectionChecker);

// Register the checker so that it can be used by name.
Blockly.registry.register(
    Blockly.registry.Type.CONNECTION_CHECKER,
    "dg_grammarian.ConnectionChecker",
    dg_grammarian.ConnectionChecker);

dg_grammarian.ConnectionChecker.up = function(a) {
    let upCheck = a.getCheck();
    if (upCheck != null)
        return upCheck;

    if (a.getSourceBlock() == null)
        return null;

    if (a.getSourceBlock().type == "ConceptualEditor.Item" &&
        a.getParentInput() != null &&
        a.getParentInput().name == "of") {

        let block = a.getSourceBlock().previousConnection.targetBlock();
        while (block != null && block.type == "ConceptualEditor.Item") {
            upCheck = dg_grammarian.ConnectionChecker.down(block.getInput("of").connection);
            if (upCheck != null)
                return upCheck;
            block = block.previousConnection.targetBlock();
        }

        if (block != null &&
            block.outputConnection != null &&
            block.outputConnection.targetConnection != null) {
            upCheck = dg_grammarian.ConnectionChecker.up(block.outputConnection.targetConnection);
            if (upCheck != null)
                return upCheck;
        }

        block = a.getSourceBlock().nextConnection.targetBlock();
        while (block != null) {
            upCheck = dg_grammarian.ConnectionChecker.down(block.getInput("of").connection);
            if (upCheck != null)
                return upCheck;
            block = block.nextConnection.targetBlock();
        }
    } else if (a.getSourceBlock().type == "ConceptualEditor.Option") {
        const parent = a.getSourceBlock().getParent();
        if (parent != null &&
            parent.outputConnection != null &&
            parent.outputConnection.targetConnection != null) {
            upCheck = dg_grammarian.ConnectionChecker.up(parent.outputConnection.targetConnection);
        }
    }

    return upCheck;
}
dg_grammarian.ConnectionChecker.down = function(b) {
    let downCheck = b.getCheck();
    if (downCheck != null)
        return downCheck;

    if (b.getSourceBlock() == null)
        return null;

    if (b.getSourceBlock().type == "ConceptualEditor.Item") {
        const conn = b.getSourceBlock().getInput("of").connection;
        if (conn.targetConnection != null)
            downCheck = dg_grammarian.ConnectionChecker.down(conn.targetConnection);
    } else if (b.getSourceBlock().type == "ConceptualEditor.Option") {
        let item = b.getSourceBlock().getInput("do").connection.targetBlock();
        while (item != null) {
            const conn = item.getInput("of").connection;
            if (conn.targetConnection != null) {
                downCheck = dg_grammarian.ConnectionChecker.down(conn.targetConnection);
                if (downCheck != null)
                    break;
            }
            item = item.nextConnection.targetBlock();
        }
    }

    return downCheck;
}
dg_grammarian.ConnectionChecker.prototype.doTypeChecks = function(a, b) {
    const upCheck   = dg_grammarian.ConnectionChecker.up(a);
    if (upCheck   == null)
        return true;

    const downCheck = dg_grammarian.ConnectionChecker.down(b);
    if (downCheck == null)
        return true;

    // Find any intersection in the check lists.
    for (let i = 0; i < upCheck.length; i++) {
        if (downCheck.indexOf(upCheck[i]) != -1) {
            return true;
        }
    }

    // No intersection.
    return false;
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

    from.addEventListener("multisel_changed", function(e) {
        gfwordnet.selection = e.selection;
        if (e.new_current) {
            dg_grammarian.init_phrases(phrases);
        }
        if (dg_grammarian.context != null) {
            dg_grammarian.context.reset();
            dg_grammarian.regenerate(event.new_language,event.new_current).then(null, gfwordnet.errcont);
        }
    });

    gfwordnet.selection = getMultiSelection(from);
    gfwordnet.lex_ids = {};

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200 && this.responseXML != null) {
            dg_grammarian.workspace =
                Blockly.inject(blocklyDiv,
                    {toolbox: toolbox
                    ,theme: {startHats: true}
                    ,scrollbars: true
                    ,plugins: {
                        [Blockly.registry.Type.CONNECTION_CHECKER]: "dg_grammarian.ConnectionChecker"
                     }
                    });

            const dom = Blockly.Xml.textToDom(this.responseText);
            Blockly.Xml.domToWorkspace(dom, dg_grammarian.workspace);

            dg_grammarian.editor = new ConceptualEditor();
            eval(Blockly.JavaScript.workspaceToCode(dg_grammarian.workspace));
            dg_grammarian.init_phrases(phrases).then(null, gfwordnet.errcont);
        }
    };
    xhttp.open("GET", url, true);
    xhttp.send();
}
dg_grammarian.init_phrases = async function(phrases) {
    clear(phrases);
    const sentences = dg_grammarian.editor.getSentences();
    for (let i = 0; i < sentences.length; i++) {
        const cell = td([]);
        cell.addEventListener("click", function(e) {
                dg_grammarian.onclick_sentence(this.parentNode, sentences[i]);
            });
        const context = new ChoiceContext(dg_grammarian.editor);
        dg_grammarian.linearize_ui(await sentences[i].getDesciption(context),cell);
        phrases.appendChild(tr(cell));
    }
}
dg_grammarian.regenerate = async function(update_lin,update_choices) {
	var linearization = element('linearization');
	var choices = element('choices');

	var expr = await this.sentence.getAbstractSyntax(this.context);

	if (update_lin) {
		function extract_linearization(lins) {
			const table = gfwordnet.build_alignment_table(lins,[]);
			clear(linearization);
			linearization.appendChild(table);
		}
		gfwordnet.grammar_call("command=c-bracketedLinearize&to="+gfwordnet.selection.langs_list.join("%20")+"&tree="+encodeURIComponent(expr),extract_linearization);
	}

	if (update_choices) {
		clear(choices);
		for (var i in this.context.choices) {
			const choice = this.context.choices[i];
			const desc   = await choice.getNode().getDescription(new ChoiceContext(dg_grammarian.editor));
			let edit   = null;
			let cell   = null;

			if (choice.getNode() instanceof ConceptualEditor.Boolean) {
				edit = node("input", {type: "checkbox", onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				if (desc != null) {
					edit = node("label", {}, [edit]);
					cell = edit;
				}
			} else if (choice.getNode() instanceof ConceptualEditor.Lexicon || choice.getNode() instanceof ConceptualEditor.Query) {
				cell = td([]);
				choices.appendChild(tr(cell));

				edit = node("select", {style: "width: 100%",
									   onchange: "dg_grammarian.onchange_option("+i+",this.value)"}, []);
				edit.addEventListener("mousedown", this.ontoggle_lexicon_search);

				var items       = choice.getOptions();
				var options     = {}
				var lexical_ids = ""
				for (var j = 0; j < items.length; j++) {
					var lemma  = await items[j].getDescription(new ChoiceContext(dg_grammarian.editor));
					
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
					const item_desc = await items[j].getDescription(new ChoiceContext(dg_grammarian.editor));

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
        this.regenerate(true,true).then(null, gfwordnet.errcont);

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
	this.regenerate(true,true).then(null, gfwordnet.errcont);
}

dg_grammarian.onedit_rules = function(editBtn, phrases, linearization, choices, blocklyDiv) {
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
        dg_grammarian.init_phrases(phrases);
        editBtn.value = "Edit";
        blocklyDiv.style.display = "none";
    }
}
