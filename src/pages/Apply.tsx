import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Send, CheckCircle2, User, Mail, Phone, MapPin, MessageSquare, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import YamilookLogo from "@/components/brand/YamilookLogo";

const applySchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").max(255),
  phone: z.string().optional(),
  city: z.string().optional(),
  social_handle: z.string().optional(),
  motivation: z.string().min(20, "Conta-nos um pouco mais (mínimo 20 caracteres)").max(1000),
});

type ApplyFormValues = z.infer<typeof applySchema>;

export default function Apply() {
  useUiLocale();
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      city: "",
      social_handle: "",
      motivation: "",
    },
  });

  const onSubmit = async (values: ApplyFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("mvp_candidates").insert({
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim() || null,
        city: values.city?.trim() || null,
        social_handle: values.social_handle?.trim() || null,
        motivation: values.motivation.trim(),
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          toast.error(uiText("Este email já foi submetido. Aguarda a nossa resposta!"));
        } else {
          toast.error(uiText("Erro ao enviar candidatura. Tenta novamente."));
        }
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error(uiText("Erro inesperado. Tenta novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-start px-6 py-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <YamilookLogo size="md" showTagline={false} animate={false} />
        </motion.div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">{uiText("Candidatura enviada! 🎉")}</h2>
              <p className="text-muted-foreground mb-2">{uiText("Recebemos a tua candidatura para o MVP do Yamilook.")}</p>
              <p className="text-muted-foreground text-sm">{uiText("Se fores selecionado, receberás um email com o teu código de acesso exclusivo. Mantém o olho na caixa de entrada!")}</p>
              <div className="mt-8 p-4 bg-secondary/50 rounded-2xl w-full">
                <p className="text-xs text-muted-foreground">{uiText("📧 Verifica também a pasta de spam caso não recebas nada em 5-7 dias úteis.")}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">{uiText("Candidatura MVP 🇦🇴")}</h1>
                <p className="text-muted-foreground text-sm">{uiText("Faz parte dos primeiros a experimentar o Yamilook. Preenche o formulário e entraremos em contacto se fores selecionado.")}</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Nome */}
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{uiText("Nome completo *")}</FormLabel>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={uiText("O teu nome")}
                                className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                                disabled={isLoading}
                              />
                            </FormControl>
                          </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{uiText("Email *")}</FormLabel>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="nome@exemplo.com"
                                className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                                disabled={isLoading}
                              />
                            </FormControl>
                          </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Telefone + Cidade */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{uiText("Telefone")}</FormLabel>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={uiText("+244 9xx...")}
                                  className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                                  disabled={isLoading}
                                />
                              </FormControl>
                            </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{uiText("Cidade")}</FormLabel>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={uiText("Luanda...")}
                                  className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                                  disabled={isLoading}
                                />
                              </FormControl>
                            </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Redes sociais */}
                  <FormField
                    control={form.control}
                    name="social_handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{uiText("Instagram / TikTok")}</FormLabel>
                          <div className="relative">
                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={uiText("@o_teu_username")}
                                className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                                disabled={isLoading}
                              />
                            </FormControl>
                          </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Motivação */}
                  <FormField
                    control={form.control}
                    name="motivation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{uiText("Porque queres fazer parte do MVP? *")}</FormLabel>
                          <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder={uiText("Conta-nos o que te motiva a fazer parte desta fase inicial do Yamilook...")}
                                className="pl-10 min-h-[120px] rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary resize-none"
                                disabled={isLoading}
                              />
                            </FormControl>
                          </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl font-semibold mt-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{uiText("A enviar candidatura...")}</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />{uiText("Enviar Candidatura")}</>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center pt-1">{uiText("Ao submeter, aceitas os nossos{{value1}}", { value1: (" ") })}<a href="/terms" className="underline hover:text-foreground">{uiText("Termos de Serviço")}</a>{" "}
                    e{" "}
                    <a href="/privacy" className="underline hover:text-foreground">{uiText("Política de Privacidade")}</a>
                    .
                  </p>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
