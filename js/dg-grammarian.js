dg_grammarian = {}

dg_grammarian.parse = function (sentence, result) {
	function errcont(text,code) { }
	function extract_linearization(lins) {
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
												"onclick": "gfwordnet.onclick_bracket(event, this)"},
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
			rows.push(tr([td(taggedBrackets(lin.brackets))]));
		}
		result.appendChild(node("table",{class: "result"},rows), this.nextSibling);
	}
	function extract_parse(parses) {
		gfwordnet.grammar_call("?command=c-bracketedLinearize&to=ParseEng&tree="+encodeURIComponent(parses[0].trees[0].tree),extract_linearization,errcont);
	}
	gfwordnet.grammar_call("?command=c-parse&from=ParseEng&input="+encodeURIComponent(sentence),extract_parse,errcont);
}
dg_grammarian.load_phrases = function(url) {
	function extract_phrases(xml) {
		dg_grammarian.xmlDoc = xml.responseXML;

		var table = document.getElementById("phrases");
		var nodes = dg_grammarian.xmlDoc.documentElement.childNodes;
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].nodeName == "sentence") {
				table.appendChild(tr(node("td", {onclick: "dg_grammarian.onclick_sentence('"+nodes[i].getAttribute("id")+"')"}, [text(nodes[i].getAttribute("desc"))])));
			}
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
dg_grammarian.onclick_sentence = function(id) {
	var node = dg_grammarian.xmlDoc.getElementById(id);
	alert(node);
}
