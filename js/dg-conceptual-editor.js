function ConceptualEditor(xmlDoc) {
	this.xmlDoc = xmlDoc;

	var notWhitespace = /\S/

	function filter(root) {
		var i = 0;
		while (i < root.childNodes.length) {
			var node = root.childNodes[i];
			if ((node.nodeType == 3) && (!notWhitespace.test(node.nodeValue)) ||
			    (node.nodeType == 8)) {
				// that is, if it's a whitespace text node
				root.removeChild(node);
			} else {
				filter(node);
				i++;
			}
		}
	}

	filter(xmlDoc.documentElement);
}
ConceptualEditor.prototype.getGrammarURL = function() {
	return this.xmlDoc.getElementsByTagName("grammar")[0].getAttribute("url");
}
ConceptualEditor.prototype.getLanguages = function() {
	var langs = [];
	var langNodes = this.xmlDoc.getElementsByTagName("language");
	for (var i = 0; i < langNodes.length; i++) {
		langs.push({concr:  langNodes[i].getAttribute("concr"),
		            input:  langNodes[i].getAttribute("input") == "true",
		            output: langNodes[i].getAttribute("output") == "true",
			        name:   langNodes[i].textContent
			       });
	}
	return langs;
}
ConceptualEditor.prototype.getNode = function(id) {
	return this.xmlDoc.getElementById(id);
}
ConceptualEditor.prototype.getSentences = function(id) {
	return this.xmlDoc.getElementsByTagName("sentence");
}
ConceptualEditor.prototype.getAbstractSyntax = function(node,context) {
	if (node.nodeName == "sentence") {
		return this.getAbstractSyntaxSentence(node,context);
	} else if (node.nodeName == "function") {
		return this.getAbstractSyntaxFunction(node,context);
	} else if (node.nodeName == "option") {
		return this.getAbstractSyntaxOption(node,context);
	} else if (node.nodeName == "lexicon") {
		return this.getAbstractSyntaxOption(node,context);
	} else if (node.nodeName == "boolean") {
		return this.getAbstractSyntaxOption(node,context);
	} else if (node.nodeName == "numeral") {
		return this.getAbstractSyntaxNumeral(node,context);
	} else if (node.nodeName == "call") {
		return this.getAbstractSyntaxCall(node,context);
	} else if (node.nodeName == "argument") {
		return this.getAbstractSyntaxArgument(node,context);
	}
	return null;
}
ConceptualEditor.prototype.getAbstractSyntaxSentence = function(node,context) {
	var child = node.firstChild;
	var expr = this.getAbstractSyntax(child,context);
	context.trim();
	return expr;
}
ConceptualEditor.prototype.getAbstractSyntaxFunction = function(node,context) {
	var func      = node.getAttribute("name");
	var arguments = node.childNodes;
	if (arguments == null || arguments.length == 0) {
		// context.incrementFId(function.size()); --??
		if (func.indexOf(' ') >= 0)
			func = "("+func+")";
		return func;
	}

	// context.incrementFId(function.size()-1); --??

	var expr = func;
	for (var i = 0; i < arguments.length; i++) {
		expr += " " + this.getAbstractSyntax(arguments[i],context);
	}
	expr = "("+expr+")";

	// context.incrementFId(1);

	return expr;
}
ConceptualEditor.prototype.getAbstractSyntaxOption = function(node,context) {
	var options = node.childNodes;
	var parent  = context.changeParentNode(node);
	var expr = this.getAbstractSyntax(options[context.choose(node)],context);
	context.changeParentNode(parent);
	return expr;
}
ConceptualEditor.prototype.getAbstractSyntaxCall = function(node,context) {
	var ref       = this.xmlDoc.getElementById(node.getAttribute("ref"));
	var arguments = node.childNodes;

	context.push(arguments);
	var res = this.getAbstractSyntax(ref,context);
	context.pop();
	return res;
}
ConceptualEditor.prototype.getAbstractSyntaxArgument = function(node,context) {
	var attr = node.getAttribute("index");
	var index = (attr == null) ? 0 : parseInt(attr);
	return this.getAbstractSyntax(context.getArgument(index),context);
}

function ChoiceContext() {
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
			var ref = node.getAttribute("ref");
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
	if (node.nodeName != "option" && node.nodeName != "lexicon")
		return 0;

	var default_id     = node.getAttribute("default");
	var persistence_id = node.getAttribute("persistence_id");
	var options        = node.childNodes;

	var position = 0;
	if (default_id != null) {
		for (var i = 0; i < options.length; i++) {
			if (default_id == options[i].id) {
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
	if (node.nodeName != "string")
		return null;

	var default_value  = node.getAttribute("default");
	var persistence_id = node.getAttribute("persistence_id");

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
	return this.node.childNodes;
}
