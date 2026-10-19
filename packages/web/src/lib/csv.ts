export function spreadsheetCell(value: string): string {
	const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
	return `"${safe.replaceAll('"', '""')}"`;
}
