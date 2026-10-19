import { error } from '@sveltejs/kit';
import { evaluationInputs, evaluationWorksheet } from '#lib/evaluation.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const files = {
		'inputs.txt': { body: evaluationInputs, type: 'text/plain', filename: 'iscn-evaluation-inputs.txt' },
		'worksheet.csv': { body: evaluationWorksheet, type: 'text/csv', filename: 'iscn-evaluation-worksheet.csv' }
	};
	if (params.file !== 'inputs.txt' && params.file !== 'worksheet.csv') error(404, 'Evaluation file not found');
	const file = files[params.file];
	return new Response(file.body(), { headers: {
		'Content-Type': `${file.type}; charset=utf-8`,
		'Content-Disposition': `attachment; filename="${file.filename}"`,
		'X-Content-Type-Options': 'nosniff'
	} });
};
