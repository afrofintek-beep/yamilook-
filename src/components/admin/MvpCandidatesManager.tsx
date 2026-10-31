import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Copy,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  ChevronDown,
  MessageSquare,
  AtSign,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  social_handle: string | null;
  motivation: string | null;
  status: "pending" | "approved" | "rejected";
  access_code: string | null;
  code_used: boolean;
  code_used_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  invite_sent_at: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", icon: Clock },
  approved: { label: "Aprovado", color: "bg-green-500/15 text-green-600 border-green-500/30", icon: CheckCircle },
  rejected: { label: "Rejeitado", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

export function MvpCandidatesManager() {
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; candidate: Candidate | null }>({
    open: false,
    candidate: null,
  });
  const [rejectReason, setRejectReason] = useState("");
  const [approvedDialog, setApprovedDialog] = useState<{
    open: boolean;
    code: string;
    name: string;
    email: string;
  }>({ open: false, code: "", name: "", email: "" });

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("mvp_candidates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(true);
      toast.error("Erro ao carregar candidatos");
    } else {
      setCandidates((data as Candidate[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleApprove = async (candidate: Candidate) => {
    setActionLoading(candidate.id);
    try {
      const { data, error } = await supabase.rpc("approve_mvp_candidate", {
        p_candidate_id: candidate.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; access_code?: string; candidate_name?: string; candidate_email?: string };

      if (!result.success) {
        toast.error(result.error || "Erro ao aprovar");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id ? { ...c, status: "approved", access_code: result.access_code! } : c
        )
      );

      setApprovedDialog({
        open: true,
        code: result.access_code!,
        name: result.candidate_name!,
        email: result.candidate_email!,
      });

      toast.success(`${candidate.full_name} aprovado!`);
    } catch {
      toast.error("Erro inesperado ao aprovar candidato");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.candidate) return;
    setActionLoading(rejectDialog.candidate.id);
    try {
      const { data, error } = await supabase.rpc("reject_mvp_candidate", {
        p_candidate_id: rejectDialog.candidate.id,
        p_reason: rejectReason.trim() || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        toast.error(result.error || "Erro ao rejeitar");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === rejectDialog.candidate!.id
            ? { ...c, status: "rejected", rejection_reason: rejectReason.trim() || null }
            : c
        )
      );

      toast.success("Candidatura rejeitada");
      setRejectDialog({ open: false, candidate: null });
      setRejectReason("");
    } catch {
      toast.error("Erro inesperado ao rejeitar candidato");
    } finally {
      setActionLoading(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const copyEmailTemplate = (candidate: Candidate) => {
    const template = `Olá ${candidate.full_name},

Parabéns! A tua candidatura para o MVP do Yamilook foi aprovada! 🎉

O teu código de acesso exclusivo é:

${candidate.access_code}

Para criar a tua conta:
1. Acede a https://www.yamilook.com/register
2. Clica em "Criar conta"
3. Insere o teu código quando solicitado

Bem-vindo(a) à nossa comunidade!

Equipa Yamilook 🇦🇴`;

    navigator.clipboard.writeText(template);
    toast.success("Template de email copiado!");
  };

  const sendCandidateEmail = async (candidate: Candidate) => {
    setSending(candidate.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-mvp-candidate-invitation', { body: { candidateId: candidate.id } });
      if (error || !data?.accepted) throw error || new Error('Delivery failed');
      toast.success('Email aceite pelo serviço de envio. A entrega depende do destinatário.');
      await fetchCandidates();
    } catch {
      toast.error('Não foi possível enviar o email. Podes copiar a mensagem ou partilhar pelo WhatsApp.');
    } finally { setSending(null); }
  };
  const shareCandidate = (candidate: Candidate) => {
    const text = `Olá ${candidate.full_name}, a tua candidatura à YAMILOOK foi aprovada!\n\nCria a tua conta em https://www.yamilook.com/register e insere o código ${candidate.access_code}.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const filtered = candidates.filter((c) => {
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      c.full_name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.social_handle?.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: candidates.length,
    pending: candidates.filter((c) => c.status === "pending").length,
    approved: candidates.filter((c) => c.status === "approved").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-primary" />
                Candidatos MVP
              </CardTitle>
              <CardDescription>
                Gere as candidaturas para o acesso ao MVP
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchCandidates} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "p-2 rounded-xl text-center transition-all border",
                  filterStatus === s
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary/50 border-transparent text-muted-foreground hover:bg-secondary"
                )}
              >
                <p className="text-lg font-bold">{counts[s]}</p>
                <p className="text-xs capitalize">
                  {s === "all" ? "Total" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
                </p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar candidatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (<div role="alert">Não foi possível carregar candidatos. <Button onClick={fetchCandidates}>Tentar novamente</Button></div>) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum candidato encontrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.map((candidate) => {
                const cfg = statusConfig[candidate.status];
                const StatusIcon = cfg.icon;
                return (
                  <Collapsible key={candidate.id}>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">{candidate.full_name}</p>
                              <Badge
                                variant="outline"
                                className={cn("text-xs px-1.5 py-0 shrink-0", cfg.color)}
                              >
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {cfg.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
                            {candidate.city && (
                              <p className="text-xs text-muted-foreground">{candidate.city}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {new Date(candidate.created_at).toLocaleDateString("pt")}
                            </p>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-3">
                          {/* Details */}
                          <div className="grid grid-cols-2 gap-2 pt-3">
                            {candidate.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                {candidate.phone}
                              </div>
                            )}
                            {candidate.city && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {candidate.city}
                              </div>
                            )}
                            {candidate.social_handle && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <AtSign className="w-3 h-3" />
                                {candidate.social_handle}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {candidate.email}
                            </div>
                          </div>

                          {candidate.motivation && (
                            <div className="bg-secondary/50 rounded-lg p-3">
                              <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Motivação
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {candidate.motivation}
                              </p>
                            </div>
                          )}

                          {/* Access Code (approved) */}
                          {candidate.access_code && (
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1 text-primary">
                                <Key className="w-3 h-3" /> Código de Acesso
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm font-mono font-bold tracking-widest text-primary">
                                  {candidate.access_code}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => copyCode(candidate.access_code!)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              {candidate.code_used && (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ Utilizado em {new Date(candidate.code_used_at!).toLocaleDateString("pt")}
                                </p>
                              )}
                              {!candidate.code_used && (<div className="flex flex-wrap gap-2 mt-2">
                                <Button size="sm" disabled={sending === candidate.id} onClick={() => sendCandidateEmail(candidate)}>{sending === candidate.id ? 'A enviar…' : 'Enviar email'}</Button>
                                <Button size="sm" variant="outline" onClick={() => shareCandidate(candidate)}>Partilhar WhatsApp</Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full mt-2 h-7 text-xs gap-1"
                                  onClick={() => copyEmailTemplate(candidate)}
                                >
                                  <Mail className="w-3 h-3" />
                                  Copiar template de email
                                </Button></div>
                              )}
                            </div>
                          )}

                          {candidate.rejection_reason && (
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                              <p className="text-xs font-medium mb-1 text-destructive">Motivo de rejeição</p>
                              <p className="text-xs text-muted-foreground">{candidate.rejection_reason}</p>
                            </div>
                          )}

                          {/* Actions (only for pending) */}
                          {candidate.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1 gap-1 h-8 text-xs"
                                onClick={() => handleApprove(candidate)}
                                disabled={actionLoading === candidate.id}
                              >
                                {actionLoading === candidate.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1 h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                                onClick={() => setRejectDialog({ open: true, candidate })}
                                disabled={actionLoading === candidate.id}
                              >
                                <XCircle className="w-3 h-3" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialog({ open: false, candidate: null });
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar candidatura</DialogTitle>
            <DialogDescription>
              {rejectDialog.candidate?.full_name} — {rejectDialog.candidate?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Motivo da rejeição (opcional, não será enviado ao candidato)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, candidate: null })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === rejectDialog.candidate?.id}
            >
              {actionLoading === rejectDialog.candidate?.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approved Dialog */}
      <Dialog
        open={approvedDialog.open}
        onOpenChange={(open) => setApprovedDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎉 Candidato aprovado!</DialogTitle>
            <DialogDescription>
              {approvedDialog.name} foi aprovado. Envia-lhe o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Código de acesso</p>
              <code className="text-2xl font-mono font-bold tracking-widest text-primary">
                {approvedDialog.code}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={() => copyCode(approvedDialog.code)}
              >
                <Copy className="w-4 h-4" />
                Copiar código
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  const candidate = candidates.find((c) => c.access_code === approvedDialog.code);
                  if (candidate) copyEmailTemplate(candidate);
                }}
              >
                <Mail className="w-4 h-4" />
                Copiar email
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Envia este código para <strong>{approvedDialog.email}</strong>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
