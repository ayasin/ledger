// Expression tree node for complex boolean filtering
export interface FilterNode {
	type: 'filter' | 'group';

	// For filter nodes:
	field?: 'category' | 'tag' | 'account';
	value?: string;
	isEmpty?: boolean; // true if value is "-" meaning filter for empty/null

	// For group nodes:
	operator?: 'and' | 'or';
	children?: FilterNode[];
}

export interface ParsedQuery {
	filterTree?: FilterNode;
	dateRange?: { from: Date; to: Date };
	// Legacy fields for backward compatibility
	filters: FilterExpression[];
	operator?: 'and' | 'or';
}

// Legacy structure kept for backward compatibility
export interface FilterExpression {
	field: 'category' | 'tag' | 'account';
	value: string;
	isEmpty?: boolean;
	operator?: 'and' | 'or';
	group?: FilterExpression[];
}

type Token =
	| { type: 'lparen' }
	| { type: 'rparen' }
	| { type: 'and' }
	| { type: 'or' }
	| { type: 'filter'; field: 'category' | 'tag' | 'account'; value: string; isEmpty: boolean }
	| { type: 'eof' };

class Tokenizer {
	private pos = 0;
	private tokens: Token[] = [];

	constructor(private query: string) {
		this.tokenize();
	}

	private tokenize() {
		const query = this.query;
		let i = 0;

		while (i < query.length) {
			// Skip whitespace
			while (i < query.length && /\s/.test(query[i])) {
				i++;
			}

			if (i >= query.length) break;

			// Check for parentheses
			if (query[i] === '(') {
				this.tokens.push({ type: 'lparen' });
				i++;
				continue;
			}

			if (query[i] === ')') {
				this.tokens.push({ type: 'rparen' });
				i++;
				continue;
			}

			// Check for operators (case insensitive)
			if (query.substring(i, i + 3).toLowerCase() === 'and') {
				// Make sure it's a word boundary
				if (i + 3 >= query.length || /\s/.test(query[i + 3])) {
					this.tokens.push({ type: 'and' });
					i += 3;
					continue;
				}
			}

			if (query.substring(i, i + 2).toLowerCase() === 'or') {
				// Make sure it's a word boundary
				if (i + 2 >= query.length || /\s/.test(query[i + 2])) {
					this.tokens.push({ type: 'or' });
					i += 2;
					continue;
				}
			}

			// Check for filter (field:value or field:"quoted value")
			const filterMatch = query.substring(i).match(/^(category|tag|account):("([^"]+)"|(\S+))/i);
			if (filterMatch) {
				const field = filterMatch[1].toLowerCase() as 'category' | 'tag' | 'account';
				const value = filterMatch[3] || filterMatch[4];
				this.tokens.push({
					type: 'filter',
					field,
					value,
					isEmpty: value === '-'
				});
				i += filterMatch[0].length;
				continue;
			}

			// Unknown character, skip it
			i++;
		}

		this.tokens.push({ type: 'eof' });
	}

	current(): Token {
		return this.tokens[this.pos];
	}

	peek(): Token {
		return this.tokens[this.pos + 1] || { type: 'eof' };
	}

	advance(): Token {
		const token = this.current();
		if (this.pos < this.tokens.length - 1) {
			this.pos++;
		}
		return token;
	}

	isEof(): boolean {
		return this.current().type === 'eof';
	}
}

class Parser {
	constructor(private tokenizer: Tokenizer) {}

	// Parse the entire expression
	// Grammar:
	//   expression := orExpression
	//   orExpression := andExpression ('or' andExpression)*
	//   andExpression := term ('and' term)*
	//   term := filter | '(' expression ')'
	parse(): FilterNode | undefined {
		if (this.tokenizer.isEof()) {
			return undefined;
		}
		return this.parseOrExpression();
	}

	private parseOrExpression(): FilterNode {
		let left = this.parseAndExpression();

		while (this.tokenizer.current().type === 'or') {
			this.tokenizer.advance(); // consume 'or'
			const right = this.parseAndExpression();

			// Create a group node
			if (left.type === 'group' && left.operator === 'or') {
				// Extend existing OR group
				left.children!.push(right);
			} else {
				// Create new OR group
				left = {
					type: 'group',
					operator: 'or',
					children: [left, right]
				};
			}
		}

		return left;
	}

	private parseAndExpression(): FilterNode {
		let left = this.parseTerm();

		while (this.tokenizer.current().type === 'and') {
			this.tokenizer.advance(); // consume 'and'
			const right = this.parseTerm();

			// Create a group node
			if (left.type === 'group' && left.operator === 'and') {
				// Extend existing AND group
				left.children!.push(right);
			} else {
				// Create new AND group
				left = {
					type: 'group',
					operator: 'and',
					children: [left, right]
				};
			}
		}

		return left;
	}

	private parseTerm(): FilterNode {
		const token = this.tokenizer.current();

		if (token.type === 'lparen') {
			this.tokenizer.advance(); // consume '('
			const expr = this.parseOrExpression();
			if (this.tokenizer.current().type === 'rparen') {
				this.tokenizer.advance(); // consume ')'
			}
			return expr;
		}

		if (token.type === 'filter') {
			this.tokenizer.advance(); // consume filter
			return {
				type: 'filter',
				field: token.field,
				value: token.value,
				isEmpty: token.isEmpty
			};
		}

		// Error case - return empty group
		return { type: 'group', operator: 'and', children: [] };
	}
}

export function parseQuery(query: string): ParsedQuery {
	if (!query.trim()) {
		return { filters: [] };
	}

	const result: ParsedQuery = {
		filters: [],
		operator: 'and'
	};

	try {
		// Extract date range first
		const dateRangeMatch = query.match(/between\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+and\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
		if (dateRangeMatch) {
			const fromDate = parseDate(dateRangeMatch[1]);
			const toDate = parseDate(dateRangeMatch[2]);
			if (fromDate && toDate) {
				result.dateRange = { from: fromDate, to: toDate };
			}
			// Remove date range from query for further processing
			query = query.replace(dateRangeMatch[0], '').trim();
		}

		// Parse filter expression tree
		const tokenizer = new Tokenizer(query);
		const parser = new Parser(tokenizer);
		result.filterTree = parser.parse();

		// Build legacy flat filters array for backward compatibility
		result.filters = flattenFilterTree(result.filterTree);
	} catch (error) {
		console.error('Error parsing query:', error);
		return { filters: [] };
	}

	return result;
}

function flattenFilterTree(node?: FilterNode): FilterExpression[] {
	if (!node) return [];

	if (node.type === 'filter') {
		return [{
			field: node.field!,
			value: node.value!,
			isEmpty: node.isEmpty
		}];
	}

	if (node.type === 'group' && node.children) {
		const flattened: FilterExpression[] = [];
		for (const child of node.children) {
			flattened.push(...flattenFilterTree(child));
		}
		return flattened;
	}

	return [];
}

function parseDate(dateStr: string): Date | null {
	// Parse MM/DD/YY or MM/DD/YYYY format
	const parts = dateStr.split('/');
	if (parts.length !== 3) return null;

	let month = parseInt(parts[0], 10);
	let day = parseInt(parts[1], 10);
	let year = parseInt(parts[2], 10);

	// Handle 2-digit year
	if (year < 100) {
		year += year < 50 ? 2000 : 1900;
	}

	// Create date (month is 0-indexed in JS)
	const date = new Date(year, month - 1, day);

	// Validate date
	if (isNaN(date.getTime())) return null;

	return date;
}

// Serialize filter tree to URL query string
export function buildQueryString(parsed: ParsedQuery): string {
	const params = new URLSearchParams();

	// Add date range
	if (parsed.dateRange) {
		params.append('from_date', parsed.dateRange.from.toISOString());
		params.append('to_date', parsed.dateRange.to.toISOString());
	}

	// Serialize filter tree as JSON and encode it
	if (parsed.filterTree) {
		params.append('filter_expr', JSON.stringify(serializeFilterNode(parsed.filterTree)));
	}

	return params.toString();
}

function serializeFilterNode(node: FilterNode): any {
	if (node.type === 'filter') {
		return {
			type: 'filter',
			field: node.field,
			value: node.isEmpty ? '~empty~' : node.value
		};
	}

	if (node.type === 'group') {
		return {
			type: 'group',
			operator: node.operator,
			children: node.children?.map(serializeFilterNode) || []
		};
	}

	return null;
}
