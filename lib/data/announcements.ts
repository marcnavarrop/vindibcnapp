import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

export type AnnouncementInput = {
  title: string;
  body: string;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  if (USE_MOCK) {
    const store = getStore();
    return store.announcements
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        authorName:
          store.profiles.find((p) => p.id === a.author_id)?.full_name ?? null,
        createdAt: a.created_at,
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      `id, title, body, created_at,
       author:profiles!announcements_author_id_fkey(full_name)`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    title: string;
    body: string;
    created_at: string;
    author: { full_name: string | null } | null;
  };
  return (data as unknown as Row[]).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    authorName: a.author?.full_name ?? null,
    createdAt: a.created_at,
  }));
}

export async function getAnnouncement(
  id: string,
): Promise<AnnouncementInput | null> {
  if (USE_MOCK) {
    const a = getStore().announcements.find((x) => x.id === id);
    return a ? { title: a.title, body: a.body } : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("title, body")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? { title: data.title, body: data.body } : null;
}

export async function createAnnouncement(
  input: AnnouncementInput,
  authorId: string,
): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.announcements.push({
      id,
      author_id: authorId,
      title: input.title,
      body: input.body,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ author_id: authorId, title: input.title, body: input.body })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const a = store.announcements.find((x) => x.id === id);
    if (!a) throw new Error("Publicació no trobada.");
    a.title = input.title;
    a.body = input.body;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ title: input.title, body: input.body })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.announcements = store.announcements.filter((x) => x.id !== id);
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
