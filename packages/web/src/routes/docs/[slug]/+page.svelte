<script lang="ts">
	import GuideContent from '#lib/docs/GuideContent.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.guide.title} | ISCN Authenticator</title>
	<meta name="description" content={data.guide.description} />
</svelte:head>

<GuideContent guide={data.guide} />
