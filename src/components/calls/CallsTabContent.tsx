import { lazy, Suspense, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Phone, 
  Video, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Plus,
  Calendar,
  Timer,
  Voicemail,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useCalls, CallHistory } from '@/hooks/useCalls';
const ScheduleCallSheet = lazy(() => import('@/components/calls/ScheduleCallSheet').then(m => ({ default: m.ScheduleCallSheet })));
import { ScheduledCallCard } from '@/components/calls/ScheduledCallCard';
import { VoicemailRecorder } from '@/components/calls/VoicemailRecorder';
import { OnlineStatus } from '@/components/ui/OnlineStatus';
import { useMultipleUserStatus } from '@/hooks/useOnlineStatus';

interface CallsTabContentProps {
  onStartCall?: (userId: string, type: 'voice' | 'video') => Promise<void>;
}

export function CallsTabContent({ onStartCall }: CallsTabContentProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { 
    callHistory, 
    scheduledCalls,
    scheduledError,
    scheduledLoading,
    fetchScheduledCalls,
    loading, 
    getCallStatistics,
  } = useCalls();
  
  const [activeTab, setActiveTab] = useState('all');
  const [voicemailOpen, setVoicemailOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string } | null>(null);
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalDuration: number;
    videoCalls: number;
    voiceCalls: number;
  } | null>(null);

  // Get all participant user IDs for status tracking
  const participantIds = [...new Set(callHistory.flatMap(call => 
    call.participants.map(p => p.user_id)
  ))];
  const { statuses } = useMultipleUserStatus(participantIds);

  useEffect(() => {
    getCallStatistics('month').then(setStats);
  }, [getCallStatistics]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds === 0) {
      return '< 1m';
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m`;
    }
    return `${secs}s`;
  };

  const formatStatsDuration = (seconds: number | null) => {
    if (!seconds || seconds === 0) {
      return '0h 0m';
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatCallTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) return '';
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMM d');
  };

  const getCallIcon = (call: CallHistory) => {
    if (call.status === 'missed' || call.status === 'declined') {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    return call.participants.length > 0 ? (
      <PhoneOutgoing className="w-4 h-4 text-green-500" />
    ) : (
      <PhoneIncoming className="w-4 h-4 text-primary" />
    );
  };

  const handleStartCall = async (userId: string, type: 'voice' | 'video') => {
    if (onStartCall) {
      await onStartCall(userId, type);
    } else {
      // Fallback: navigate to contacts to start a call
      navigate('/contacts');
    }
  };

  const filteredHistory = callHistory.filter(call => {
    if (activeTab === 'missed') {
      return call.status === 'missed' || call.status === 'declined';
    }
    return true;
  });

  const groupedCalls = filteredHistory.reduce((groups, call) => {
    const date = call.started_at || call.ended_at;
    if (!date || !Number.isFinite(new Date(date).getTime())) {
      (groups['Data indisponível'] ??= []).push(call);
      return groups;
    }
    
    const dateKey = isToday(new Date(date)) 
      ? 'Today' 
      : isYesterday(new Date(date)) 
        ? 'Yesterday' 
        : format(new Date(date), 'MMMM d, yyyy');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(call);
    return groups;
  }, {} as Record<string, CallHistory[]>);

  return (
    <div className="flex flex-col flex-1">
      {/* Stats Banner */}
      {stats && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-primary text-white shadow-lg">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                <Phone className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold">{stats.totalCalls}</p>
              <p className="text-[10px] opacity-80">{t('calls.totalCalls')}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                <Timer className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold">{formatStatsDuration(stats.totalDuration)}</p>
              <p className="text-[10px] opacity-80">{t('calls.duration')}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                <Video className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold">{stats.videoCalls}</p>
              <p className="text-[10px] opacity-80">{t('calls.videoCalls')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-3">
        <TabsList className="mx-4 bg-secondary/80 p-1">
          <TabsTrigger 
            value="all" 
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            {t('contacts.all')}
          </TabsTrigger>
          <TabsTrigger 
            value="missed" 
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            {t('calls.missed')}
          </TabsTrigger>
          <TabsTrigger 
            value="scheduled" 
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            {t('calls.scheduled')}
          </TabsTrigger>
        </TabsList>

        {/* All & Missed Calls */}
        <TabsContent value="all" className="flex-1 overflow-y-auto mt-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(groupedCalls).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Phone className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('calls.noCallsYet')}</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                {t('calls.startCall')}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2">
              {Object.entries(groupedCalls).map(([date, calls]) => (
                <div key={date} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                    {date}
                  </h3>
                  <div className="space-y-1">
                    <AnimatePresence>
                      {calls.map((call, index) => (
                        <motion.div
                          key={call.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 cursor-pointer"
                        >
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={call.participants[0]?.avatar_url || ''} />
                              <AvatarFallback className="bg-gradient-primary text-white">
                                {call.participants[0]?.display_name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            {call.participants[0]?.user_id && (
                              <OnlineStatus
                                isOnline={statuses[call.participants[0].user_id]?.is_online ?? false}
                                lastSeen={statuses[call.participants[0].user_id]?.last_seen}
                                showOnlineStatus={statuses[call.participants[0].user_id]?.show_online_status ?? true}
                                showLastSeen={statuses[call.participants[0].user_id]?.show_last_seen ?? true}
                                size="sm"
                                className="absolute -bottom-0.5 -right-0.5"
                              />
                            )}
                            {call.is_group_call && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs text-white">
                                {call.participants.length + 1}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {call.participants[0]?.display_name || 'Unknown'}
                              {call.participants.length > 1 && ` +${call.participants.length - 1}`}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {getCallIcon(call)}
                              <span>{call.type === 'video' ? t('calls.videoCall') : t('calls.voiceCall')}</span>
                              <span>•</span>
                              <span>{formatDuration(call.duration_seconds)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatCallTime(call.started_at)}
                            </span>
                            {/* Voicemail button for missed calls */}
                            {(call.status === 'missed' || call.status === 'declined') && call.participants[0] && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContact({
                                    id: call.participants[0].user_id,
                                    name: call.participants[0].display_name,
                                  });
                                  setVoicemailOpen(true);
                                }}
                              >
                                <Voicemail className="w-5 h-5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (call.participants[0]) {
                                  handleStartCall(call.participants[0].user_id, call.type);
                                }
                              }}
                            >
                              {call.type === 'video' ? (
                                <Video className="w-5 h-5 text-primary" />
                              ) : (
                                <Phone className="w-5 h-5 text-primary" />
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="missed" className="flex-1 overflow-y-auto mt-0">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <PhoneMissed className="w-10 h-10 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('calls.noMissedCalls')}</h3>
              <p className="text-muted-foreground text-sm max-w-[250px]">
                {t('calls.noMissedCallsDesc')}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2">
              {Object.entries(groupedCalls).map(([date, calls]) => (
                <div key={date} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                    {date}
                  </h3>
                  <div className="space-y-1">
                    {calls.map((call) => (
                      <motion.div
                        key={call.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 cursor-pointer"
                      >
                        <div className="relative">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={call.participants[0]?.avatar_url || ''} />
                            <AvatarFallback className="bg-gradient-primary text-white">
                              {call.participants[0]?.display_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {call.participants[0]?.user_id && (
                            <OnlineStatus
                              isOnline={statuses[call.participants[0].user_id]?.is_online ?? false}
                              lastSeen={statuses[call.participants[0].user_id]?.last_seen}
                              size="sm"
                              className="absolute -bottom-0.5 -right-0.5"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-destructive">
                            {call.participants[0]?.display_name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <PhoneMissed className="w-4 h-4 text-destructive" />
                            <span>{t('calls.missed')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (call.participants[0]) {
                                setSelectedContact({
                                  id: call.participants[0].user_id,
                                  name: call.participants[0].display_name,
                                });
                                setVoicemailOpen(true);
                              }
                            }}
                          >
                            <Voicemail className="w-5 h-5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (call.participants[0]) {
                                handleStartCall(call.participants[0].user_id, 'voice');
                              }
                            }}
                          >
                            <Phone className="w-5 h-5 text-primary" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Scheduled Calls */}
        <TabsContent value="scheduled" className="flex-1 overflow-y-auto mt-0">
          {scheduledError ? <div role="alert" className="p-4 space-y-3"><p>Não foi possível carregar os agendamentos.</p><Button onClick={()=>void fetchScheduledCalls()}>Tentar novamente</Button></div> : scheduledLoading ? <p className="p-4">A carregar agendamentos…</p> : scheduledCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('calls.noScheduledCalls')}</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-[250px]">
                {t('calls.scheduleCallDesc')}
              </p>
              <Button 
                className="rounded-xl bg-gradient-primary text-white shadow-md hover:shadow-lg transition-shadow"
                onClick={() => setScheduleOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('calls.scheduleCall')}
              </Button>
            </div>
          ) : (
            <div className="px-4 py-2 space-y-3">
              {scheduledCalls.map((call) => (
                <ScheduledCallCard
                  key={call.id}
                  call={call}
                  onJoin={() => navigate(`/call/${call.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Call Sheet */}
      {scheduleOpen && <Suspense fallback={<p role="status">A carregar agendamento…</p>}><ScheduleCallSheet open={scheduleOpen} onOpenChange={setScheduleOpen} /></Suspense>}

      {/* Voicemail Recorder */}
      {selectedContact && (
        <VoicemailRecorder
          toUserId={selectedContact.id}
          toUserName={selectedContact.name}
          isOpen={voicemailOpen}
          onClose={() => {
            setVoicemailOpen(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
}
