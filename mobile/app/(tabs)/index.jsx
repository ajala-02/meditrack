import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/api/axios';

const conditionCopy = {
  cardiac: { label: 'Cardiac recovery', icon: 'heart', color: '#C86456' },
  diabetes: { label: 'Diabetes care', icon: 'activity', color: '#AF8050' },
  ortho: { label: 'Orthopaedic recovery', icon: 'move', color: '#507D78' },
  other: { label: 'Recovery plan', icon: 'plus-circle', color: '#507D78' },
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profileVisible, setProfileVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [pulseVisible, setPulseVisible] = useState(false);
  const [patientPlan, setPatientPlan] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [pulseText, setPulseText] = useState('');
  const [pulseResult, setPulseResult] = useState(null);
  const [pulseLanguage, setPulseLanguage] = useState('en');
  const [followUpAnswers, setFollowUpAnswers] = useState([]);
  const [pulseNotice, setPulseNotice] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportNotice, setReportNotice] = useState('');
  const recognitionRef = useRef(null);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const care = conditionCopy[user?.condition?.toLowerCase()] || conditionCopy.other;
  const recoverySignal = checkIns.slice(0, 7).reverse();

  useEffect(() => {
    const loadRecoveryPlan = async () => {
      try {
        const { data } = await api.get('/patients/me');
        setPatientPlan(data.patient);
        setCheckIns(data.checkIns || []);
      } catch (error) {
        console.warn('Could not load recovery plan', error.message);
      }
    };
    loadRecoveryPlan();
  }, []);

  const openPulse = () => {
    setPulseText('');
    setPulseNotice('');
    setPulseResult(null);
    setFollowUpAnswers([]);
    setPulseVisible(true);
  };

  const startPulseListening = () => {
    setPulseNotice('');
    if (Platform.OS !== 'web') {
      setPulseNotice('Voice transcription is available in the web preview. You can still type your update below.');
      return;
    }
    const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setPulseNotice('Voice recognition is not supported by this browser. Please type your update below.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[pulseLanguage] || 'en-IN';
    recognition.onresult = (event) => setPulseText(Array.from(event.results).map((result) => result[0].transcript).join(' ').trim());
    recognition.onerror = () => {
      setPulseNotice('We could not hear that. Please allow microphone access and try again.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const analyzePulse = async () => {
    if (!pulseText.trim()) return;
    setIsAnalyzing(true);
    setPulseNotice('');
    try {
      const { data } = await api.post('/checkins/analyze-symptom', { text: pulseText.trim(), language: pulseLanguage });
      setPulseResult(data.symptom);
    } catch (error) {
      setPulseNotice(error.response?.data?.message || 'We could not analyze that update. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const completeFollowUps = async () => {
    if (!pulseResult?.followUpQuestions?.length || followUpAnswers.some((answer) => !answer.trim())) return;
    setIsAnalyzing(true);
    setPulseNotice('');
    try {
      const { data } = await api.post('/checkins/follow-up', {
        text: pulseText.trim(),
        language: pulseLanguage,
        answers: followUpAnswers,
      });
      setPulseResult(data.symptom);
    } catch (error) {
      setPulseNotice(error.response?.data?.message || 'We could not complete the assessment. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = async () => {
    setReportNotice('Preparing your PDF report…');
    try {
      const response = await api.get('/reports/me', { responseType: 'blob' });
      if (Platform.OS !== 'web') {
        setReportNotice('Your report is ready. Native download sharing will be connected next.');
        return;
      }
      const url = globalThis.URL.createObjectURL(response.data);
      const link = globalThis.document.createElement('a');
      link.href = url;
      link.download = 'MediTrack-recovery-report.pdf';
      globalThis.document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
      setReportNotice('Your recovery report has downloaded.');
    } catch (error) {
      setReportNotice(error.response?.data?.message || 'We could not generate the report. Please try again.');
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out of MediTrack?', 'You can sign back in anytime with your email and recovery code.', [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setProfileVisible(false);
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR RECOVERY SPACE</Text>
            <Text style={styles.greeting}>Good morning, {firstName}.</Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile and account menu"
            accessibilityRole="button"
            onPress={() => setProfileVisible(true)}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeOrbOne} />
          <View style={styles.welcomeOrbTwo} />
          <View style={styles.todayPill}>
            <View style={styles.todayDot} />
            <Text style={styles.todayPillText}>TODAY’S FOCUS</Text>
          </View>
          <Text style={styles.welcomeTitle}>A small check-in{`\n`}can make a big difference.</Text>
          <Text style={styles.welcomeCopy}>Tell us how you feel today. Your care team will stay informed.</Text>
          <Pressable onPress={() => router.push('/checkin')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Start today’s check-in</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your recovery at a glance</Text>
          <Text style={styles.sectionLabel}>ACTIVE PLAN</Text>
        </View>

        <Pressable onPress={() => setPlanVisible(true)} style={({ pressed }) => [styles.statusCard, pressed && styles.pressed]}>
          <View style={[styles.statusIcon, { backgroundColor: `${care.color}18` }]}>
            <Feather name={care.icon} size={20} color={care.color} />
          </View>
          <View style={styles.statusBody}>
            <Text style={styles.statusTitle}>{care.label}</Text>
            <Text style={styles.statusCaption}>Your monitoring plan is active</Text>
          </View>
          <View style={styles.planLink}><Text style={styles.activeBadgeText}>View plan</Text><Feather name="chevron-right" size={15} color="#398260" /></View>
        </Pressable>

        {recoverySignal.length ? (
          <View style={styles.signalCard}>
            <View style={styles.signalHeader}>
              <View>
                <Text style={styles.signalTitle}>Recovery signal</Text>
                <Text style={styles.signalCaption}>Your recent check-in pattern</Text>
              </View>
              <View style={styles.stableBadge}><View style={styles.stableDot} /><Text style={styles.stableText}>Monitoring</Text></View>
            </View>
            <View style={styles.chartArea}>
              {recoverySignal.map((checkIn, index) => (
                <View key={checkIn._id || index} style={styles.chartColumn}>
                  <View style={styles.chartTrack}><View style={[styles.chartBar, { height: `${Math.max(18, (checkIn.overallScore || 1) * 18)}%` }, checkIn.riskStatus === 'critical' && styles.chartBarAlert]} /></View>
                  <Text style={styles.chartLabel}>D{index + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.quickGrid}>
          <Pressable
            onPress={openPulse}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <View style={[styles.quickIcon, styles.quickIconGreen]}><Feather name="mic" size={19} color="#1F6B62" /></View>
            <Text style={styles.quickTitle}>Recovery Pulse</Text>
            <Text style={styles.quickCopy}>Speak or tap how you feel</Text>
            <View style={styles.quickArrow}><Feather name="arrow-up-right" size={16} color="#1F6B62" /></View>
          </Pressable>
          <Pressable onPress={() => router.push('/messages')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <View style={[styles.quickIcon, styles.quickIconSand]}><Feather name="message-circle" size={19} color="#A46A48" /></View>
            <Text style={styles.quickTitle}>Care team</Text>
            <Text style={styles.quickCopy}>Ask a question</Text>
            <View style={styles.quickArrow}><Feather name="arrow-up-right" size={16} color="#A46A48" /></View>
          </Pressable>
        </View>

        <View style={styles.roadmapHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recovery Roadmap</Text>
            <Text style={styles.roadmapCaption}>Your care journey, one day at a time</Text>
          </View>
          <Pressable onPress={() => router.push('/timeline')} style={styles.viewPlanButton}>
            <Text style={styles.viewPlanText}>View plan</Text>
            <Feather name="arrow-right" size={14} color="#1F6B62" />
          </Pressable>
        </View>

        <View style={styles.roadmapCard}>
          <View style={styles.roadmapLine} />
          <View style={styles.milestoneRow}>
            <View style={[styles.milestoneDot, styles.milestoneDone]}><Feather name="check" size={12} color="#FFFFFF" /></View>
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneLabel}>Discharge day</Text>
              <Text style={styles.milestoneDate}>Your recovery plan began</Text>
            </View>
            <Text style={styles.completeLabel}>Complete</Text>
          </View>
          <View style={styles.milestoneRow}>
            <View style={[styles.milestoneDot, styles.milestoneToday]}><View style={styles.milestoneInnerDot} /></View>
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneLabel}>Today’s check-in</Text>
              <Text style={styles.milestoneDate}>A quick update helps your team</Text>
            </View>
            <View style={styles.todayLabel}><Text style={styles.todayLabelText}>Today</Text></View>
          </View>
          <View style={styles.milestoneRow}>
            <View style={[styles.milestoneDot, styles.milestoneFuture]} />
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneLabel}>Recovery review</Text>
              <Text style={styles.milestoneDate}>Your progress summary will appear here</Text>
            </View>
          </View>
        </View>

        <View style={styles.supportCard}>
          <View style={styles.supportIcon}><FontAwesome5 name="hands-helping" size={17} color="#2F8C7D" /></View>
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>You’re not recovering alone</Text>
            <Text style={styles.supportCopy}>Reach out to your care team if something doesn’t feel right.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#76908A" />
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={pulseVisible} onRequestClose={() => setPulseVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPulseVisible(false)}>
          <Pressable style={styles.pulseSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.pulseSheetIcon}><Feather name="mic" size={22} color="#1F6B62" /></View>
            <Text style={styles.pulseSheetTitle}>Recovery Pulse</Text>
            <Text style={styles.pulseSheetCopy}>How has recovery felt today? Speak naturally or type a short update. AI will identify symptoms for your check-in.</Text>

            {!pulseResult ? (
              <>
                <View style={styles.languageRow}>
                  {[['en', 'English'], ['hi', 'हिन्दी'], ['mr', 'मराठी']].map(([code, label]) => <Pressable key={code} onPress={() => setPulseLanguage(code)} style={[styles.languagePill, pulseLanguage === code && styles.languagePillActive]}><Text style={[styles.languagePillText, pulseLanguage === code && styles.languagePillTextActive]}>{label}</Text></Pressable>)}
                </View>
                <Pressable onPress={isListening ? () => recognitionRef.current?.stop() : startPulseListening} style={({ pressed }) => [styles.listenButton, (pressed || isListening) && styles.listenButtonActive]}>
                  <Feather name={isListening ? 'square' : 'mic'} size={19} color="#FFFFFF" />
                  <Text style={styles.listenButtonText}>{isListening ? 'Listening… tap to stop' : 'Speak your update'}</Text>
                </Pressable>
                <Text style={styles.orText}>OR TYPE IT BELOW</Text>
                <TextInput
                  multiline
                  onChangeText={setPulseText}
                  placeholder="For example: I felt more tired walking today and my ankles are a little swollen."
                  placeholderTextColor="#98A8A3"
                  style={styles.pulseInput}
                  textAlignVertical="top"
                  value={pulseText}
                />
                {pulseNotice ? <Text style={styles.pulseNotice}>{pulseNotice}</Text> : null}
                <Pressable disabled={!pulseText.trim() || isAnalyzing} onPress={analyzePulse} style={({ pressed }) => [styles.analyzeButton, (!pulseText.trim() || isAnalyzing || pressed) && styles.disabledButton]}>
                  {isAnalyzing ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.analyzeButtonText}>Let AI identify symptoms</Text><Feather name="sparkles" size={17} color="#FFFFFF" /></>}
                </Pressable>
              </>
            ) : (
              <View style={styles.resultPanel}>
                {pulseResult.followUpQuestions?.length ? <>
                  <View style={styles.resultTitleRow}><Feather name="message-circle" size={19} color="#398260" /><Text style={styles.resultTitle}>A few quick questions</Text></View>
                  <Text style={styles.resultCopy}>Your answers help MediTrack give safer, more useful recovery guidance.</Text>
                  {pulseResult.followUpQuestions.map((question, index) => <View key={question} style={styles.followUpGroup}><Text style={styles.followUpQuestion}>{question}</Text><TextInput multiline onChangeText={(value) => setFollowUpAnswers((current) => { const next = [...current]; next[index] = value; return next; })} placeholder="Type your answer" placeholderTextColor="#98A8A3" style={styles.followUpInput} textAlignVertical="top" value={followUpAnswers[index] || ''} /></View>)}
                  {pulseNotice ? <Text style={styles.pulseNotice}>{pulseNotice}</Text> : null}
                  <Pressable disabled={isAnalyzing || followUpAnswers.length !== pulseResult.followUpQuestions.length || followUpAnswers.some((answer) => !answer?.trim())} onPress={completeFollowUps} style={({ pressed }) => [styles.analyzeButton, (isAnalyzing || followUpAnswers.length !== pulseResult.followUpQuestions.length || followUpAnswers.some((answer) => !answer?.trim()) || pressed) && styles.disabledButton]}>{isAnalyzing ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.analyzeButtonText}>Continue assessment</Text><Feather name="arrow-right" size={17} color="#FFFFFF" /></>}</Pressable>
                </> : <>
                  <View style={styles.resultTitleRow}><Feather name="check-circle" size={19} color="#398260" /><Text style={styles.resultTitle}>AI found a symptom to review</Text></View>
                <Text style={styles.resultSymptom}>{pulseResult.name}</Text>
                <Text style={styles.resultDetails}>Reported severity: {pulseResult.severity || 'Not specified'} / 5</Text>
                <View style={[styles.urgencyBadge, pulseResult.urgency === 'urgent' && styles.urgencyBadgeUrgent]}><Text style={[styles.urgencyText, pulseResult.urgency === 'urgent' && styles.urgencyTextUrgent]}>{pulseResult.urgency === 'urgent' ? 'URGENT REVIEW' : pulseResult.urgency === 'monitor' ? 'MONITOR CLOSELY' : 'ROUTINE UPDATE'}</Text></View>
                <Text style={styles.resultSectionLabel}>WHY IT MAY MATTER</Text><Text style={styles.resultCopy}>{pulseResult.possibleExplanation}</Text>
                <Text style={styles.resultSectionLabel}>SUGGESTED NEXT STEP</Text><Text style={styles.resultCopy}>{pulseResult.nextStep}</Text>
                <Text style={styles.safetyText}>This is support information, not a diagnosis. If symptoms feel severe or rapidly worsen, seek urgent care.</Text>
                <Pressable onPress={() => { setPulseVisible(false); router.push('/checkin'); }} style={styles.reviewButton}><Text style={styles.reviewButtonText}>Review in check-in</Text><Feather name="arrow-right" size={17} color="#1F6B62" /></Pressable>
                <Pressable onPress={downloadReport} style={styles.reportButton}><Feather name="file-text" size={16} color="#41645B" /><Text style={styles.reportButtonText}>Generate recovery report</Text></Pressable>
                {reportNotice ? <Text style={styles.reportNotice}>{reportNotice}</Text> : null}
                </>}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={planVisible} onRequestClose={() => setPlanVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPlanVisible(false)}>
          <Pressable style={styles.planSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.planSheetHeading}><View style={[styles.statusIcon, { backgroundColor: `${care.color}18` }]}><Feather name={care.icon} size={20} color={care.color} /></View><View><Text style={styles.planSheetTitle}>{care.label}</Text><Text style={styles.planSheetSubtitle}>{patientPlan?.diagnosis || 'Your active monitoring plan'}</Text></View></View>
            <Text style={styles.planSectionTitle}>Your focus today</Text>
            {(patientPlan?.recoveryInstructions?.dos?.slice(0, 3) || ['Complete your daily check-in', 'Follow your prescribed recovery routine']).map((instruction) => <View key={instruction} style={styles.planInstruction}><Feather name="check" size={15} color="#2F8C7D" /><Text style={styles.planInstructionText}>{instruction}</Text></View>)}
            <Text style={styles.planSectionTitle}>Contact your care team if</Text>
            {(patientPlan?.recoveryInstructions?.redFlags?.slice(0, 2) || ['Your symptoms feel worse or unexpected']).map((flag) => <View key={flag} style={styles.flagInstruction}><Feather name="alert-circle" size={15} color="#BD634D" /><Text style={styles.flagInstructionText}>{flag}</Text></View>)}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={profileVisible} onRequestClose={() => setProfileVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileVisible(false)}>
          <Pressable style={styles.profileSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.profileSummary}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{firstName.charAt(0).toUpperCase()}</Text></View>
              <View>
                <Text style={styles.profileName}>{user?.name || 'MediTrack patient'}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>
            <View style={styles.sheetDivider} />
            <Pressable onPress={() => setProfileVisible(false)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}>
              <View style={styles.menuIcon}><Feather name="bell" size={18} color="#41615B" /></View>
              <Text style={styles.menuText}>Notification preferences</Text>
              <Feather name="chevron-right" size={19} color="#91A19D" />
            </Pressable>
            <Pressable onPress={() => setProfileVisible(false)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}>
              <View style={styles.menuIcon}><Feather name="help-circle" size={18} color="#41615B" /></View>
              <Text style={styles.menuText}>Help and support</Text>
              <Feather name="chevron-right" size={19} color="#91A19D" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmLogout} style={({ pressed }) => [styles.logoutItem, pressed && styles.menuPressed]}>
              <View style={styles.logoutIcon}><Feather name="log-out" size={18} color="#B34F45" /></View>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  scrollContent: { padding: 20, paddingBottom: 112 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 23 },
  eyebrow: { color: '#A36A4B', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  greeting: { color: '#173B36', fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginTop: 4 },
  avatarButton: { alignItems: 'center', backgroundColor: '#DDEBE3', borderColor: '#C8DDD2', borderRadius: 19, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: '#1F6B62', fontSize: 16, fontWeight: '800' },
  onlineDot: { backgroundColor: '#5FAE88', borderColor: '#F6F4EE', borderRadius: 8, borderWidth: 2, bottom: -2, height: 13, position: 'absolute', right: -2, width: 13 },
  welcomeCard: { backgroundColor: '#216E64', borderRadius: 24, marginBottom: 28, overflow: 'hidden', padding: 23 },
  welcomeOrbOne: { backgroundColor: 'rgba(177, 218, 193, 0.17)', borderRadius: 100, height: 172, position: 'absolute', right: -58, top: -66, width: 172 },
  welcomeOrbTwo: { backgroundColor: 'rgba(245, 204, 164, 0.14)', borderRadius: 90, bottom: -79, height: 146, position: 'absolute', right: 31, width: 146 },
  todayPill: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'flex-start', borderRadius: 99, flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 6 },
  todayDot: { backgroundColor: '#F3B37E', borderRadius: 99, height: 6, width: 6 },
  todayPillText: { color: '#E8F3EB', fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.9, lineHeight: 32, marginTop: 17 },
  welcomeCopy: { color: '#D7E9DF', fontSize: 13.5, lineHeight: 20, marginTop: 9, maxWidth: 270 },
  primaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#F8F5EC', borderRadius: 13, flexDirection: 'row', gap: 9, marginTop: 20, paddingHorizontal: 15, paddingVertical: 13 },
  primaryButtonText: { color: '#1F6B62', fontSize: 13.5, fontWeight: '800' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#24433E', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sectionLabel: { color: '#84948F', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  statusCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8E7E1', borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: 15, shadowColor: '#29443E', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.05, shadowRadius: 9 },
  statusIcon: { alignItems: 'center', borderRadius: 13, height: 44, justifyContent: 'center', width: 44 },
  statusBody: { flex: 1, marginLeft: 12 },
  statusTitle: { color: '#254740', fontSize: 14, fontWeight: '800' },
  statusCaption: { color: '#80908B', fontSize: 11.5, marginTop: 3 },
  activeBadge: { backgroundColor: '#E5F2E9', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  planLink: { alignItems: 'center', backgroundColor: '#E5F2E9', borderRadius: 99, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5 },
  activeBadgeText: { color: '#398260', fontSize: 10.5, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  quickCard: { backgroundColor: '#FFFFFF', borderColor: '#E8E7E1', borderRadius: 18, borderWidth: 1, flex: 1, minHeight: 150, padding: 15 },
  quickIcon: { alignItems: 'center', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  quickIconGreen: { backgroundColor: '#E5F2E9' },
  quickIconSand: { backgroundColor: '#F8EADF' },
  quickTitle: { color: '#284740', fontSize: 13.5, fontWeight: '800', marginTop: 14 },
  quickCopy: { color: '#82918D', fontSize: 11.5, marginTop: 4 },
  quickArrow: { bottom: 13, position: 'absolute', right: 13 },
  roadmapHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 27, marginBottom: 12 },
  roadmapCaption: { color: '#81918D', fontSize: 11.5, marginTop: 3 },
  viewPlanButton: { alignItems: 'center', flexDirection: 'row', gap: 5, padding: 5 },
  viewPlanText: { color: '#1F6B62', fontSize: 11.5, fontWeight: '800' },
  roadmapCard: { backgroundColor: '#FFFFFF', borderColor: '#E8E7E1', borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 7, position: 'relative' },
  roadmapLine: { backgroundColor: '#DCE9E1', bottom: 26, left: 28, position: 'absolute', top: 27, width: 2 },
  milestoneRow: { alignItems: 'center', flexDirection: 'row', minHeight: 58, position: 'relative' },
  milestoneDot: { alignItems: 'center', borderRadius: 99, height: 20, justifyContent: 'center', width: 20 },
  milestoneDone: { backgroundColor: '#4EA979' },
  milestoneToday: { backgroundColor: '#DFF0E6', borderColor: '#2F8C7D', borderWidth: 2 },
  milestoneInnerDot: { backgroundColor: '#2F8C7D', borderRadius: 99, height: 6, width: 6 },
  milestoneFuture: { backgroundColor: '#FFFFFF', borderColor: '#BFCFC8', borderWidth: 2 },
  milestoneBody: { flex: 1, marginLeft: 12 },
  milestoneLabel: { color: '#37564F', fontSize: 12.5, fontWeight: '800' },
  milestoneDate: { color: '#82918D', fontSize: 10.5, marginTop: 2 },
  completeLabel: { color: '#56A47A', fontSize: 10.5, fontWeight: '800' },
  todayLabel: { backgroundColor: '#E9F3EB', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  todayLabelText: { color: '#388160', fontSize: 10, fontWeight: '800' },
  signalCard: { backgroundColor: '#FFFFFF', borderColor: '#E8E7E1', borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 15 },
  signalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  signalTitle: { color: '#284740', fontSize: 13.5, fontWeight: '800' },
  signalCaption: { color: '#82918D', fontSize: 10.5, marginTop: 3 },
  stableBadge: { alignItems: 'center', backgroundColor: '#E9F3EB', borderRadius: 99, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 5 },
  stableDot: { backgroundColor: '#4EA979', borderRadius: 99, height: 6, width: 6 },
  stableText: { color: '#398260', fontSize: 9.5, fontWeight: '800' },
  chartArea: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, height: 88, marginTop: 14 },
  chartColumn: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartTrack: { backgroundColor: '#EDF3EF', borderRadius: 99, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', width: 10 },
  chartBar: { backgroundColor: '#68A987', borderRadius: 99, minHeight: 8, width: '100%' },
  chartBarAlert: { backgroundColor: '#D9846A' },
  chartLabel: { color: '#91A09C', fontSize: 9, marginTop: 5 },
  supportCard: { alignItems: 'center', backgroundColor: '#E7F0EB', borderColor: '#D8E6DE', borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginTop: 22, padding: 15 },
  supportIcon: { alignItems: 'center', backgroundColor: '#D6E8DD', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  supportContent: { flex: 1, marginHorizontal: 11 },
  supportTitle: { color: '#31584F', fontSize: 13, fontWeight: '800' },
  supportCopy: { color: '#66807A', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  modalBackdrop: { backgroundColor: 'rgba(20, 46, 40, 0.34)', flex: 1, justifyContent: 'flex-end' },
  pulseSheet: { backgroundColor: '#FCFBF7', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 31 },
  pulseSheetIcon: { alignItems: 'center', backgroundColor: '#DCEBE3', borderRadius: 15, height: 48, justifyContent: 'center', marginTop: -3, width: 48 },
  pulseSheetTitle: { color: '#24433E', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 14 },
  pulseSheetCopy: { color: '#6D7E79', fontSize: 13, lineHeight: 19, marginTop: 6 },
  languageRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  languagePill: { backgroundColor: '#EEF3EF', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  languagePillActive: { backgroundColor: '#D5E9DD' },
  languagePillText: { color: '#70817D', fontSize: 11.5, fontWeight: '700' },
  languagePillTextActive: { color: '#1F6B62', fontWeight: '800' },
  listenButton: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 18, padding: 15 },
  listenButtonActive: { backgroundColor: '#BC604E' },
  listenButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  orText: { color: '#97A39F', fontSize: 9.5, fontWeight: '800', letterSpacing: 1, marginTop: 17, textAlign: 'center' },
  pulseInput: { backgroundColor: '#F6F8F5', borderColor: '#DCE5E0', borderRadius: 14, borderWidth: 1, color: '#24433E', fontSize: 13.5, height: 91, lineHeight: 19, marginTop: 10, padding: 13 },
  pulseNotice: { color: '#B45A4A', fontSize: 11.5, lineHeight: 17, marginTop: 9 },
  analyzeButton: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 13, minHeight: 51, paddingHorizontal: 15 },
  disabledButton: { opacity: 0.52 },
  analyzeButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  resultPanel: { backgroundColor: '#EAF3ED', borderColor: '#D6E6DB', borderRadius: 16, borderWidth: 1, marginTop: 17, padding: 16 },
  resultTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  resultTitle: { color: '#3B6A59', fontSize: 12.5, fontWeight: '800' },
  resultSymptom: { color: '#23473F', fontSize: 19, fontWeight: '800', marginTop: 13 },
  resultDetails: { color: '#6E827B', fontSize: 12, marginTop: 4 },
  resultCopy: { color: '#527168', fontSize: 12, lineHeight: 18, marginTop: 11 },
  resultSectionLabel: { color: '#2E8060', fontSize: 9.5, fontWeight: '800', letterSpacing: .85, marginTop: 14 },
  followUpGroup: { marginTop: 15 },
  followUpQuestion: { color: '#355A50', fontSize: 12.5, fontWeight: '800', lineHeight: 18 },
  followUpInput: { backgroundColor: '#FFFFFF', borderColor: '#D6E4DB', borderRadius: 11, borderWidth: 1, color: '#24433E', fontSize: 12.5, height: 58, marginTop: 7, padding: 10 },
  urgencyBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF4D8', borderRadius: 99, marginTop: 10, paddingHorizontal: 8, paddingVertical: 4 },
  urgencyBadgeUrgent: { backgroundColor: '#FCE3DE' },
  urgencyText: { color: '#9B6B25', fontSize: 9.5, fontWeight: '800', letterSpacing: .65 },
  urgencyTextUrgent: { color: '#B25043' },
  safetyText: { color: '#7A6252', fontSize: 10.5, fontStyle: 'italic', lineHeight: 15, marginTop: 14 },
  reviewButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 14, padding: 13 },
  reviewButtonText: { color: '#1F6B62', fontSize: 13, fontWeight: '800' },
  reportButton: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 12, padding: 9 },
  reportButtonText: { color: '#41645B', fontSize: 12, fontWeight: '800' },
  reportNotice: { color: '#55736A', fontSize: 10.5, marginTop: 7, textAlign: 'center' },
  planSheet: { backgroundColor: '#FCFBF7', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 32 },
  planSheetHeading: { alignItems: 'center', flexDirection: 'row' },
  planSheetTitle: { color: '#24433E', fontSize: 19, fontWeight: '800', marginLeft: 12 },
  planSheetSubtitle: { color: '#72827D', fontSize: 12, marginLeft: 12, marginTop: 3 },
  planSectionTitle: { color: '#36584F', fontSize: 12.5, fontWeight: '800', marginBottom: 10, marginTop: 21 },
  planInstruction: { alignItems: 'flex-start', flexDirection: 'row', gap: 9, marginBottom: 10 },
  planInstructionText: { color: '#557069', flex: 1, fontSize: 12.5, lineHeight: 18 },
  flagInstruction: { alignItems: 'flex-start', backgroundColor: '#FFF4F0', borderRadius: 10, flexDirection: 'row', gap: 9, marginBottom: 8, padding: 10 },
  flagInstructionText: { color: '#8F5548', flex: 1, fontSize: 12, lineHeight: 17 },
  profileSheet: { backgroundColor: '#FCFBF7', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 32 },
  sheetHandle: { alignSelf: 'center', backgroundColor: '#D4DDD8', borderRadius: 99, height: 4, marginBottom: 21, width: 42 },
  profileSummary: { alignItems: 'center', flexDirection: 'row' },
  profileAvatar: { alignItems: 'center', backgroundColor: '#DCEBE3', borderRadius: 18, height: 52, justifyContent: 'center', width: 52 },
  profileAvatarText: { color: '#1F6B62', fontSize: 21, fontWeight: '800' },
  profileName: { color: '#24433E', fontSize: 16, fontWeight: '800', marginLeft: 12 },
  profileEmail: { color: '#7D8D89', fontSize: 12, marginLeft: 12, marginTop: 3 },
  sheetDivider: { backgroundColor: '#E7E9E5', height: 1, marginVertical: 19 },
  menuItem: { alignItems: 'center', borderRadius: 13, flexDirection: 'row', paddingVertical: 12 },
  menuIcon: { alignItems: 'center', backgroundColor: '#EAF1ED', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  menuText: { color: '#36544E', flex: 1, fontSize: 13.5, fontWeight: '700', marginLeft: 11 },
  menuPressed: { backgroundColor: '#F1F5F1' },
  logoutItem: { alignItems: 'center', backgroundColor: '#FFF5F3', borderRadius: 13, flexDirection: 'row', marginTop: 15, padding: 12 },
  logoutIcon: { alignItems: 'center', backgroundColor: '#FCE3DE', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  logoutText: { color: '#B34F45', fontSize: 13.5, fontWeight: '800', marginLeft: 11 },
});
