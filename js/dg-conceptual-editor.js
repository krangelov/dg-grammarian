function ConceptualEditor() {
    this.reset();
}
ConceptualEditor.prototype.addSentence = function(id,desc,content) {
    this.sentences.push(new ConceptualEditor.Sentence(id,desc,content));
}
ConceptualEditor.prototype.getSentences = function() {
    return this.sentences;
}
ConceptualEditor.prototype.addDefinition = function(name, body) {
    this.definitions[name] = body;
}
ConceptualEditor.prototype.getDefinitionBody = function(name) {
    return this.definitions[name];
}
ConceptualEditor.prototype.reset = function() {
    this.sentences   = [];
    this.definitions = {};
}

ConceptualEditor.Sentence = function(id,desc,content) {
    this.id      = id;
    this.content = content;
    this.desc    = desc;
}
ConceptualEditor.Sentence.prototype.getAbstractSyntax = async function(context) {
	var expr = await this.content.getAbstractSyntax(context);
	context.trim();
	return expr;
}
ConceptualEditor.Sentence.prototype.getDesciption = function(context) {
    if (this.desc != null)
        return this.desc.getAbstractSyntax(context);
    else
        return this.content.getAbstractSyntax(context);
}

ConceptualEditor.Function = function() {
    this.func = arguments[0];
    this.arguments = [];
    for (var i = 1; i < arguments.length; i++) {
        this.arguments.push(arguments[i]);
    }
}
ConceptualEditor.Function.prototype.getAbstractSyntax = async function(context) {
	if (this.arguments == null || this.arguments.length == 0) {
		// context.incrementFId(function.size()); --??
		if (this.func.indexOf(' ') >= 0)
			return "("+this.func+")";
        else
            return this.func;
	}

	// context.incrementFId(function.size()-1); --??

	var expr = this.func;
	for (var i = 0; i < this.arguments.length; i++) {
		expr += " " + await this.arguments[i].getAbstractSyntax(context);
	}
	expr = "("+expr+")";

	// context.incrementFId(1);

	return expr;
}

ConceptualEditor.Item = function(content,desc) {
    this.content = content;
    this.desc    = desc;
}
ConceptualEditor.Item.prototype.getAbstractSyntax = function(context) {
    return this.content.getAbstractSyntax(context);
}
ConceptualEditor.Item.prototype.getDescription = function(context) {
    if (this.desc != null)
        return this.desc.getAbstractSyntax(context);
    else
        return this.content.getAbstractSyntax(context);
}

ConceptualEditor.Option = function() {
    this.desc  = arguments[0];
    this.items = [];
    for (var i = 1; i < arguments.length; i++) {
        this.items.push(arguments[i]);
    }
}
ConceptualEditor.Option.prototype.getAbstractSyntax = async function(context) {
	var parent  = context.changeParentNode(this);
	var expr = await this.items[context.choose(this)].getAbstractSyntax(context);
	context.changeParentNode(parent);
	return expr;
}
ConceptualEditor.Option.prototype.getDescription = function(context) {
	if (this.desc == null)
        return null;
    return this.desc.getAbstractSyntax(context);
}

ConceptualEditor.Lexicon = function() {
    this.id    = arguments[0];
    this.desc  = arguments[1];
    this.items = [];
    for (var i = 2; i < arguments.length; i++) {
        this.items.push(arguments[i]);
    }
}
ConceptualEditor.Lexicon.prototype.getAbstractSyntax = async function(context) {
	var parent  = context.changeParentNode(this);
	var expr = this.items[context.choose(this)].getAbstractSyntax(context);
	context.changeParentNode(parent);
	return expr;
}
ConceptualEditor.Lexicon.prototype.getDescription = function(context) {
	if (this.desc == null)
        return null;
    return this.desc.getAbstractSyntax(context);
}

ConceptualEditor.Boolean = function(desc,checked,unchecked) {
    this.desc  = desc;
    this.items = [checked, unchecked];
}
ConceptualEditor.Boolean.prototype.getAbstractSyntax = async function(context) {
	const parent = context.changeParentNode(this);
    let expr = await this.items[context.choose(this)].getAbstractSyntax(context);
	context.changeParentNode(parent);
	return expr;
}
ConceptualEditor.Boolean.prototype.getDescription = function(context) {
	if (this.desc == null)
        return null;
    return this.desc.getAbstractSyntax(context);
}

ConceptualEditor.Numeral = function(desc,min,max,def) {
    this.desc    = desc;
    this.min     = min;
    this.max     = max;
    this.default = def;
}
ConceptualEditor.Numeral.prototype.getAbstractSyntax = async function(context) {
	function subs1000(nbr) {
        var syntax = "";
        if (nbr < 100) {
            syntax = "(pot1as2 " + subs100(nbr) + ")";
        } else if(nbr % 100 == 0) {
            syntax = "(pot2 " + subs10(Math.floor(nbr/100)) + ")";
        } else if(nbr > 100 && nbr%100 != 0) {
            syntax = "(pot2plus " + subs10(Math.floor(nbr/100)) + " " + subs100(nbr%100) + ")";
        }
        return syntax;
    }

    function subs100(nbr) {
        var syntax = "";
        if (nbr < 10) {
            syntax = "(pot0as1 " + subs10(nbr) + ")";
        } else if (nbr == 10 || nbr == 11) {
            syntax = "pot1" + nbr;
        } else if (nbr >= 12 && nbr <= 19) {
            syntax = "(pot1to19 n" + nbr%10 + ")";
        } else if (nbr >= 20 && nbr%10 == 0) {
            syntax = "(pot1 n" + Math.floor(nbr/10) + ")";
        } else if (nbr%10 != 0) {
            syntax = "(pot1plus n" + Math.floor(nbr/10) + " " + subs10(nbr%10) + ")";
        }
        return syntax;
    }

    function subs10(nbr) {
        var syntax = "";
        if (nbr == 1) {
            syntax = "pot01";
        } else if (nbr >= 2 && nbr <= 9) {
            syntax = "(pot0 n" + nbr + ")";
        }
        return syntax;
    }

	function nbrToSyntax(nbr) {
        var syntax = "";
        if (nbr < 1000000 && nbr > 0) {
            if (nbr <=999) {
                syntax = "(num (pot3as4 (pot2as3 " + subs1000(nbr) + ")))";
            } else if(nbr % 1000 == 0) {
                syntax = "(num (pot3as4 (pot3 " + subs1000(Math.floor(nbr/1000)) + ")))";
            } else if(nbr > 1000 && nbr%1000 != 0) {
                syntax = "(num (pot3as4 (pot3plus " + subs1000(Math.floor(nbr/1000)) + " " +
                        subs1000(nbr%1000) + ")))";
            }
            
        } else {
            alert("Input must be between 1 and 999999");
        }
        return syntax;
    }

	return nbrToSyntax(context.choose(this));
}
ConceptualEditor.Numeral.prototype.getDescription = function(context) {
	if (this.desc == null)
        return null;
    return this.desc.getAbstractSyntax(context);
}

ConceptualEditor.String = function(str) {
    this.str = str;
}
ConceptualEditor.String.prototype.getAbstractSyntax = async function(context) {
	return JSON.stringify(this.str);
}

ConceptualEditor.Query = function() {
    this.id    = arguments[0];
    this.result  = arguments[1];
    this.desc    = arguments[2];
    this.triples = [];
    for (let i = 3; i < arguments.length; i++) {
        this.triples.push(arguments[i]);
    }
    this.items   = [];
}
ConceptualEditor.Query.prototype.getAbstractSyntax = async function(context) {

    const env = {}
    for (let i in context.choices) {
        const choice = context.choices[i];

        if (choice.getNode() instanceof ConceptualEditor.Lexicon ||
            choice.getNode() instanceof ConceptualEditor.Query) {
            const items = choice.getOptions();
            const no = parseInt(i)+1
            env[choice.getNode().id] = await items[choice.getChoice()].getAbstractSyntax(new ChoiceContext(context.editor));
        }
    }
    const pattern = {
        triples: this.triples,
        env: env
    };

    response = await fetch(gfwordnet.sense_url+'?pattern_match='+this.result,
                           {method: "POST", body: JSON.stringify(pattern)});
    res = await response.json();
    this.items = []
    for (let i in res) {
        for (let fn in res[i][this.result].lex_ids) {
            this.items.push(new ConceptualEditor.Item(new ConceptualEditor.Function(fn)));
        }
    }

    if (this.items.length == 0) {
        return "?";
    } else if (this.items.length == 1) {
        return await this.items[0].getAbstractSyntax(context);
    } else {
        const parent  = context.changeParentNode(this);
        const expr = await this.items[context.choose(this)].getAbstractSyntax(context);
        context.changeParentNode(parent);
        return expr;
    }
}
ConceptualEditor.Query.prototype.getDescription = function(context) {
	if (this.desc == null)
        return null;
    return this.desc.getAbstractSyntax(context);
}

ConceptualEditor.Call = function() {
    this.ref    = arguments[0];
    this.arguments = [];
    for (let i = 1; i < arguments.length; i++) {
        this.arguments.push(arguments[i]);
    }
}
ConceptualEditor.Call.prototype.getAbstractSyntax = async function(context) {
	const body = context.editor.getDefinitionBody(this.ref);
	context.push(this.arguments);
	const res = await body.getAbstractSyntax(context);
	context.pop();
	return res;
}

ConceptualEditor.Argument = function(index) {
    this.index = index || 0;
}
ConceptualEditor.Argument.prototype.getAbstractSyntax = function(context) {
	return context.getArgument(this.index).getAbstractSyntax(context);
}

function ChoiceContext(editor) {
    this.editor  = editor;
	this.pos     = 0;
	this.choices = [];
	this.stack   = [];
	this.parentNode = null;
	this.fids    = [];
}
ChoiceContext.prototype.choose = function(node) {
	return this.getNodeChoice(node).getChoice();
}
ChoiceContext.prototype.getNodeChoice = function(node) {
	var choice = null;

	function unlink(node) {
		for (;;) {
			var ref = node.ref;
			if (ref == null)
				return node;
		}
	}

	if (this.pos < this.choices.length) {
		if (unlink(this.choices[this.pos].getNode()) == unlink(node)) {
			choice = this.choices[this.pos];
		} else {
			this.trim();
		}
	}

	if (choice == null) {
		choice = new SyntacticChoice(node, this);
		this.choices.push(choice);
	}

	this.pos++;
	return choice;
}
ChoiceContext.prototype.getDefaultChoice = function(node) {
	if (node instanceof ConceptualEditor.Numeral) {
		var def = node.default;
		if (def == null) {
			def = node.min;
			if (def == null) {
				def = 1;
			}
		}
		return def;
	}

	if (!(node instanceof ConceptualEditor.Option) && !(node instanceof ConceptualEditor.Lexicon))
		return 0;

	var default_id     = node.default;
	var persistence_id = node.persistence_id;
	var items          = node.items;

	var position = 0;
	if (default_id != null) {
		for (var i = 0; i < items.length; i++) {
			if (default_id == items[i].id) {
				position = i;
				break;
			}
		}
	}

	if (persistence_id != null) {
		position = this.getInt(persistence_id, position);
	}

	return position;
}
ChoiceContext.prototype.getDefaultLiteral = function(node) {
	if (!(node instanceof ConceptualEditor.String))
		return null;

	var default_value  = node.default;
	var persistence_id = node.persistence_id;

	if (persistence_id != null) {
		default_value = this.getString(persistence_id, default_value);
	}
	return "\""+default_value+"\"";
}
ChoiceContext.prototype.push = function(args) {
	this.stack.push(args);
}
ChoiceContext.prototype.pop = function() {
	this.stack.pop();
}
ChoiceContext.prototype.getArgument = function(i) {
	return this.stack[this.stack.length-1][i];
}
ChoiceContext.prototype.reset = function() {
	this.pos = 0;
	this.stack = [];
	this.parentNode = null;
	this.fids = [];
}
ChoiceContext.prototype.trim = function() {
	while (this.pos < this.choices.length)
		this.choices.pop();
}
ChoiceContext.prototype.changeParentNode = function(node) {
}

function SyntacticChoice(node,context) {
	this.node   = node;
	this.choice = context.getDefaultChoice(node);
	this.literal= context.getDefaultLiteral(node);
}
SyntacticChoice.prototype.getChoice = function() {
	return this.choice;
}
SyntacticChoice.prototype.setChoice = function(i) {
	this.choice = i;
}
SyntacticChoice.prototype.getNode = function() {
	return this.node;
}
SyntacticChoice.prototype.getOptions = function() {
	return this.node.items;
}
