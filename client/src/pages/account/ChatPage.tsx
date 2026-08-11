import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { EmptyState, ErrorState, PageSpinner, Spinner } from "../../components/ui/feedback";
import { Input, Textarea } from "../../components/ui/input";
import { cn, formatDateTime, initialOf, titleCase, getErrorMessage } from "../../utils";

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt?: string | null;
  createdAt?: string;
}

interface ChatContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "SUPER_ADMIN" | "TEACHER" | "STUDENT";
  avatarUrl?: string | null;
  unread: number;
  lastMessage?: ChatMessage | null;
}

export function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const contactsQuery = useQuery({
    queryKey: ["chat", "contacts"],
    queryFn: async () => (await apiGet<ChatContact[]>("/chat/contacts")).data ?? [],
    refetchInterval: 15000,
  });

  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.email} ${c.role}`.toLowerCase().includes(q));
  }, [contacts, search]);

  useEffect(() => {
    if (!selectedId && contacts.length > 0) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["chat", "messages", selectedId],
    queryFn: async () => (await apiGet<ChatMessage[]>(`/chat/messages/${selectedId}`)).data ?? [],
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messagesQuery.data?.length, selectedId]);

  useEffect(() => {
    if (!selectedId || messagesQuery.isFetching) return;
    qc.invalidateQueries({ queryKey: ["header", "notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["student", "notifications"] });
  }, [messagesQuery.isFetching, qc, selectedId]);

  const sendMutation = useMutation({
    mutationFn: async () => apiPost<ChatMessage>("/chat/messages", { recipientId: selectedId, body }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["chat", "contacts"] });
      qc.invalidateQueries({ queryKey: ["chat", "messages", selectedId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim() || !selectedId) return;
    sendMutation.mutate();
  }

  if (contactsQuery.isLoading) return <PageSpinner />;
  if (contactsQuery.isError) return <ErrorState message="Failed to load chat contacts" />;

  const messages = messagesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Messages</h1>
          <p className="text-sm text-muted-foreground">{subtitleForRole(user?.role)}</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid min-h-[640px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <CardHeader className="border-b">
              <CardTitle>Conversations</CardTitle>
              <div className="relative pt-2">
                <Search className="pointer-events-none absolute left-3 top-[1.65rem] size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="max-h-[560px] overflow-y-auto p-2 scrollbar-thin">
              {filteredContacts.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No contacts available"
                  description="Your available chat contacts are based on assigned teacher and student relationships."
                />
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedId(contact.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        selectedId === contact.id ? "bg-primary/10 text-primary" : "hover:bg-muted/70",
                      )}
                    >
                      <Avatar>
                        <AvatarImage src={contact.avatarUrl ?? undefined} />
                        <AvatarFallback>{initialOf(contact.firstName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{contact.firstName} {contact.lastName}</p>
                          {contact.unread > 0 ? <Badge>{contact.unread}</Badge> : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.lastMessage?.body || roleLabel(contact.role)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </aside>

          <section className="flex min-h-[640px] flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-3 border-b px-5 py-4">
                  <Avatar>
                    <AvatarImage src={selected.avatarUrl ?? undefined} />
                    <AvatarFallback>{initialOf(selected.firstName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selected.firstName} {selected.lastName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(selected.role)} · {selected.email}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/25 p-4 scrollbar-thin">
                  {messagesQuery.isLoading ? (
                    <div className="flex h-full items-center justify-center"><Spinner className="text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <EmptyState icon={MessageSquare} title="No messages yet" description="Start the conversation with a short message." />
                  ) : (
                    messages.map((message) => {
                      const mine = message.senderId === user?.id;
                      return (
                        <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[78%] rounded-lg px-3 py-2 shadow-sm",
                              mine ? "bg-primary text-primary-foreground" : "border bg-card text-card-foreground",
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                            <p className={cn("mt-1 text-[11px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                              {message.createdAt ? formatDateTime(message.createdAt) : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>

                <form onSubmit={sendMessage} className="border-t bg-card p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write a message..."
                      className="min-h-[44px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (body.trim()) sendMutation.mutate();
                        }
                      }}
                    />
                    <Button type="submit" size="icon" disabled={!body.trim() || sendMutation.isPending} aria-label="Send message">
                      {sendMutation.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a contact from the list to start chatting." />
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}

function subtitleForRole(role?: string): string {
  if (role === "STUDENT") return "Chat with your assigned teacher";
  if (role === "TEACHER") return "Chat with your students and super admins";
  if (role === "SUPER_ADMIN") return "Chat with teachers";
  return "Role-based chat";
}

function roleLabel(role: string): string {
  return titleCase(role.replace(/_/g, " "));
}
