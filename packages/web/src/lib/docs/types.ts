export interface GuideSection {
	id: string;
	title: string;
	paragraphs?: string[];
	items?: string[];
	steps?: string[];
	code?: { label: string; value: string };
	table?: { headings: string[]; rows: string[][] };
	note?: string;
	links?: { label: string; href: string }[];
}

export interface Guide {
	slug: string;
	title: string;
	description: string;
	group: 'Review notation' | 'Set up your workflow';
	keywords: string[];
	sections: GuideSection[];
}
