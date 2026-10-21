<script lang="ts">
  import EmailAccess from '#lib/components/account/EmailAccess.svelte';
  import type { ActionData, PageData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<EmailAccess mode="login" pending={data.pending} {form} />
