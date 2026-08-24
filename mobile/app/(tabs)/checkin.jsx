import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/api/axios';

const severityMeta = {
  0: { label: 'None', color: '#90A09B' },
  1: { label: 'Mild', color: '#58A277' },
  2: { label: 'Mild', color: '#58A277' },
  3: { label: 'Moderate', color: '#D59645' },
  4: { label: 'Severe', color: '#C96A57' },
  5: { label: 'Severe', color: '#C96A57' },
};

export default function CheckInScreen() {
  const { user } = useAuth();
  const [stage, setStage] = useState('form');
  const [loading, setLoading] = useState(true);
  const [symptoms, setSymptoms] = useState([]);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const loadSymptoms = async () => {
      try {
        const { data } = await api.get('/conditions');
        const condition = data.conditions.find((item) => item.name.toLowerCase() === user?.condition?.toLowerCase());
        setSymptoms((condition?.symptoms || []).map((symptom) => ({
          name: symptom.label,
          severity: 0,
          source: 'checklist',
          aiFlag: false,
          flagNote: '',
        })));
      } catch (error) {
        Alert.alert('Could not load check-in', 'Please try again in a moment.');
      } finally {
        setLoading(false);
      }
    };
    loadSymptoms();
  }, [user?.condition]);

  const activeSymptoms = symptoms.filter((symptom) => symptom.severity > 0);

  const updateSeverity = (index, severity) => {
    setSymptoms((current) => current.map((symptom, itemIndex) => (
      itemIndex === index ? { ...symptom, severity } : symptom
    )));
  };

  const openVoice = () => {
    setVoiceText('');
    setVoiceNotice('');
    setVoiceVisible(true);
  };

  const startListening = () => {
    setVoiceNotice('');
    if (Platform.OS !== 'web') {
      setVoiceNotice('Voice transcription is available in the web preview. You can type your update below on this device.');
      return;
    }
    const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice('This browser does not support voice recognition. Please type your update below.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => setVoiceText(Array.from(event.results).map((item) => item[0].transcript).join(' ').trim());
    recognition.onerror = () => {
      setVoiceNotice('We could not hear that. Please allow microphone access and try again.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const analyzeVoice = async () => {
    if (!voiceText.trim()) return;
    setIsAnalyzing(true);
    setVoiceNotice('');
    try {
      const { data } = await api.post('/checkins/analyze-symptom', { text: voiceText.trim(), language: 'en' });
      const extracted = data.symptom;
      setSymptoms((current) => [...current, {
        name: extracted.name,
        severity: extracted.severity || 1,
        source: 'voiceText',
        aiFlag: Boolean(extracted.aiFlag),
        flagNote: extracted.flagNote || '',
      }]);
      setVoiceVisible(false);
      Alert.alert('Symptom added', `${extracted.name} is ready for you to review.`);
    } catch (error) {
      setVoiceNotice(error.response?.data?.message || 'MediTrack AI could not analyze that update. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitCheckIn = async () => {
    if (!activeSymptoms.length) {
      Alert.alert('Add an update first', 'Select a symptom level or use Recovery Pulse to describe how you feel.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/checkins', { symptoms: activeSymptoms, language: 'en' });
      setResult(data.checkIn);
      setStage('complete');
    } catch (error) {
      Alert.alert('Could not submit check-in', error.response?.data?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCheckIn = () => {
    setSymptoms((current) => current.map((symptom) => ({ ...symptom, severity: 0, aiFlag: false, flagNote: '' })));
    setResult(null);
    setStage('form');
  };

  if (loading) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><ActivityIndicator color="#1F6B62" size="large" /><Text style={styles.loadingText}>Preparing your check-in…</Text></View></SafeAreaView>;
  }

  if (stage === 'complete') {
    const risk = result?.riskStatus || 'stable';
    const isCritical = risk === 'critical';
    const isWatch = risk === 'watch';
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.completeContent}>
          <View style={[styles.completeIcon, isCritical ? styles.completeCritical : isWatch ? styles.completeWatch : styles.completeStable]}>
            <Feather name={isCritical ? 'alert-triangle' : isWatch ? 'eye' : 'check'} size={31} color="#FFFFFF" />
          </View>
          <Text style={styles.completeTitle}>{isCritical ? 'Your team has been alerted' : isWatch ? 'Your symptoms are under review' : 'Check-in complete'}</Text>
          <Text style={styles.completeCopy}>{isCritical ? 'A clinician has been notified. If symptoms feel urgent, contact emergency services immediately.' : isWatch ? 'Your update has been shared with your care team for review.' : 'Thank you for checking in. Your care team can see your update.'}</Text>
          <View style={styles.aiCard}><View style={styles.aiLabel}><Feather name="sparkles" size={15} color="#2F8C7D" /><Text style={styles.aiLabelText}>MEDI TRACK AI</Text></View><Text style={styles.aiMessage}>{result?.aiResponse || 'Your update has been securely recorded.'}</Text></View>
          <Pressable onPress={resetCheckIn} style={styles.doneButton}><Text style={styles.doneButtonText}>Back to check-in</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.pageHeader}>
        <View><Text style={styles.eyebrow}>DAILY RECOVERY CHECK-IN</Text><Text style={styles.headerTitle}>How are you feeling?</Text></View>
        <View style={styles.stepBadge}><Text style={styles.stepText}>{stage === 'review' ? '2 of 2' : '1 of 2'}</Text></View>
      </View>

      {stage === 'form' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
          <Text style={styles.headerCopy}>Your update helps your care team support you at the right time.</Text>
          <Pressable onPress={openVoice} style={({ pressed }) => [styles.voiceCard, pressed && styles.pressed]}>
            <View style={styles.voiceIcon}><Feather name="mic" size={21} color="#1F6B62" /></View>
            <View style={styles.voiceCardCopy}><Text style={styles.voiceCardTitle}>Use Recovery Pulse</Text><Text style={styles.voiceCardSubtext}>Speak naturally and AI will identify symptoms.</Text></View>
            <Feather name="chevron-right" size={20} color="#6E8A82" />
          </Pressable>
          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR RATE EACH SYMPTOM</Text><View style={styles.dividerLine} /></View>
          {symptoms.map((symptom, index) => {
            const meta = severityMeta[symptom.severity];
            return (
              <View key={`${symptom.name}-${index}`} style={[styles.symptomCard, symptom.severity > 0 && styles.symptomCardActive]}>
                <View style={styles.symptomHeader}><View style={styles.symptomTitleWrap}><Text style={styles.symptomName}>{symptom.name}</Text>{symptom.source === 'voiceText' ? <View style={styles.aiTag}><Feather name="sparkles" size={10} color="#2F8C7D" /><Text style={styles.aiTagText}>AI extracted</Text></View> : null}</View><Text style={[styles.severityText, { color: meta.color }]}>{meta.label}</Text></View>
                {symptom.aiFlag ? <View style={styles.flagNote}><Feather name="alert-circle" size={13} color="#B85D4C" /><Text style={styles.flagNoteText}>{symptom.flagNote || 'This symptom may need clinical review.'}</Text></View> : null}
                <Slider maximumTrackTintColor="#DDE8E1" maximumValue={5} minimumTrackTintColor={meta.color} minimumValue={0} onValueChange={(value) => updateSeverity(index, value)} step={1} style={styles.slider} thumbTintColor={meta.color} value={symptom.severity} />
                <View style={styles.sliderLabels}>{[0, 1, 2, 3, 4, 5].map((label) => <Text key={label} style={[styles.sliderLabel, symptom.severity === label && { color: meta.color }]}>{label}</Text>)}</View>
              </View>
            );
          })}
          <Pressable onPress={() => setStage('review')} style={styles.reviewAction}><Text style={styles.reviewActionText}>Review my check-in</Text><Feather name="arrow-right" size={18} color="#FFFFFF" /></Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.reviewHeading}>Review your update</Text><Text style={styles.headerCopy}>Please check the details before sharing them with your care team.</Text>
          {activeSymptoms.map((symptom) => <View key={symptom.name} style={styles.reviewItem}><View><Text style={styles.reviewName}>{symptom.name}</Text>{symptom.aiFlag ? <Text style={styles.reviewAi}>AI flagged for review</Text> : null}</View><View style={[styles.reviewSeverity, { backgroundColor: severityMeta[symptom.severity].color }]}><Text style={styles.reviewSeverityText}>{symptom.severity}</Text></View></View>)}
          {!activeSymptoms.length ? <View style={styles.emptyState}><Feather name="info" size={19} color="#A8784B" /><Text style={styles.emptyText}>No symptoms selected yet. Go back and update your check-in.</Text></View> : null}
          <View style={styles.reviewButtons}><Pressable onPress={() => setStage('form')} style={styles.backButton}><Text style={styles.backButtonText}>Go back</Text></Pressable><Pressable disabled={isSubmitting} onPress={submitCheckIn} style={({ pressed }) => [styles.submitButton, (pressed || isSubmitting) && styles.disabled]}>{isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Share update</Text>}</Pressable></View>
        </ScrollView>
      )}

      <Modal animationType="slide" transparent visible={voiceVisible} onRequestClose={() => setVoiceVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVoiceVisible(false)}><Pressable style={styles.voiceSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} /><View style={styles.sheetIcon}><Feather name="mic" size={22} color="#1F6B62" /></View><Text style={styles.sheetTitle}>Recovery Pulse</Text><Text style={styles.sheetCopy}>Say what is different today. We will turn your words into a symptom you can review before submitting.</Text>
          <Pressable onPress={isListening ? () => recognitionRef.current?.stop() : startListening} style={({ pressed }) => [styles.listenButton, (pressed || isListening) && styles.listenActive]}><Feather name={isListening ? 'square' : 'mic'} size={18} color="#FFFFFF" /><Text style={styles.listenText}>{isListening ? 'Listening… tap to stop' : 'Speak your update'}</Text></Pressable>
          <Text style={styles.orLabel}>OR TYPE YOUR UPDATE</Text><TextInput multiline onChangeText={setVoiceText} placeholder="For example: I feel breathless when I walk to the kitchen." placeholderTextColor="#98A8A3" style={styles.voiceInput} textAlignVertical="top" value={voiceText} />
          {voiceNotice ? <Text style={styles.voiceNotice}>{voiceNotice}</Text> : null}
          <Pressable disabled={!voiceText.trim() || isAnalyzing} onPress={analyzeVoice} style={({ pressed }) => [styles.analyzeButton, (!voiceText.trim() || isAnalyzing || pressed) && styles.disabled]}>{isAnalyzing ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.analyzeText}>Let AI identify symptoms</Text><Feather name="sparkles" size={17} color="#FFFFFF" /></>}</Pressable>
        </Pressable></Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' }, loadingText: { color: '#627772', fontSize: 14, marginTop: 13 },
  pageHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  eyebrow: { color: '#A36A4B', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.15 }, headerTitle: { color: '#173B36', fontSize: 24, fontWeight: '800', letterSpacing: -0.7, marginTop: 4 }, stepBadge: { backgroundColor: '#E4F0E8', borderRadius: 99, marginTop: 7, paddingHorizontal: 10, paddingVertical: 6 }, stepText: { color: '#2E8060', fontSize: 10.5, fontWeight: '800' },
  formContent: { padding: 20, paddingTop: 4, paddingBottom: 110 }, headerCopy: { color: '#6D7D79', fontSize: 13.5, lineHeight: 20 },
  voiceCard: { alignItems: 'center', backgroundColor: '#E7F0EB', borderColor: '#D6E5DC', borderRadius: 18, borderWidth: 1, flexDirection: 'row', marginTop: 18, padding: 14 }, voiceIcon: { alignItems: 'center', backgroundColor: '#D1E7D9', borderRadius: 13, height: 44, justifyContent: 'center', width: 44 }, voiceCardCopy: { flex: 1, marginHorizontal: 11 }, voiceCardTitle: { color: '#31584F', fontSize: 14, fontWeight: '800' }, voiceCardSubtext: { color: '#668078', fontSize: 11.5, marginTop: 3 },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 9, marginVertical: 22 }, dividerLine: { backgroundColor: '#DDE5DF', flex: 1, height: 1 }, dividerText: { color: '#92A09B', fontSize: 9, fontWeight: '800', letterSpacing: .85 },
  symptomCard: { backgroundColor: '#FFFFFF', borderColor: '#E4E8E3', borderRadius: 17, borderWidth: 1, marginBottom: 11, padding: 15 }, symptomCardActive: { borderColor: '#9FCDB7', backgroundColor: '#FBFEFB' }, symptomHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, symptomTitleWrap: { flex: 1, paddingRight: 8 }, symptomName: { color: '#2C4C45', fontSize: 13.5, fontWeight: '800' }, severityText: { fontSize: 11.5, fontWeight: '800' }, aiTag: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#E9F3EB', borderRadius: 99, flexDirection: 'row', gap: 4, marginTop: 7, paddingHorizontal: 7, paddingVertical: 3 }, aiTagText: { color: '#34805F', fontSize: 9.5, fontWeight: '800' }, flagNote: { alignItems: 'center', backgroundColor: '#FFF5F1', borderRadius: 9, flexDirection: 'row', gap: 6, marginTop: 10, padding: 8 }, flagNoteText: { color: '#9B594B', flex: 1, fontSize: 10.5 }, slider: { height: 35, marginTop: 7, width: '100%' }, sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 9 }, sliderLabel: { color: '#9BA8A4', fontSize: 10, fontWeight: '700' },
  reviewAction: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 12, padding: 17 }, reviewActionText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' }, pressed: { opacity: .84, transform: [{ scale: .99 }] }, disabled: { opacity: .55 },
  reviewHeading: { color: '#24443E', fontSize: 22, fontWeight: '800', letterSpacing: -.5, marginBottom: 5 }, reviewItem: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E9E5', borderRadius: 15, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 14 }, reviewName: { color: '#2A4B44', fontSize: 13.5, fontWeight: '800' }, reviewAi: { color: '#B36952', fontSize: 10.5, fontWeight: '700', marginTop: 4 }, reviewSeverity: { alignItems: 'center', borderRadius: 15, height: 31, justifyContent: 'center', width: 31 }, reviewSeverityText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, emptyState: { alignItems: 'center', backgroundColor: '#FFF8E9', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 17, padding: 13 }, emptyText: { color: '#936C42', flex: 1, fontSize: 12, lineHeight: 17 }, reviewButtons: { flexDirection: 'row', gap: 10, marginTop: 22 }, backButton: { alignItems: 'center', backgroundColor: '#E8EFEB', borderRadius: 14, flex: 1, justifyContent: 'center', padding: 16 }, backButtonText: { color: '#41625A', fontSize: 13.5, fontWeight: '800' }, submitButton: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flex: 1.25, justifyContent: 'center', minHeight: 51, padding: 16 }, submitButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  completeContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 26 }, completeIcon: { alignItems: 'center', borderRadius: 26, height: 70, justifyContent: 'center', width: 70 }, completeStable: { backgroundColor: '#51A479' }, completeWatch: { backgroundColor: '#D59645' }, completeCritical: { backgroundColor: '#C86353' }, completeTitle: { color: '#24443E', fontSize: 24, fontWeight: '800', letterSpacing: -.6, marginTop: 19, textAlign: 'center' }, completeCopy: { color: '#6B7E78', fontSize: 13.5, lineHeight: 20, marginTop: 10, textAlign: 'center' }, aiCard: { backgroundColor: '#E8F1EB', borderColor: '#D7E5DC', borderRadius: 17, borderWidth: 1, marginTop: 25, padding: 16, width: '100%' }, aiLabel: { alignItems: 'center', flexDirection: 'row', gap: 6 }, aiLabelText: { color: '#2F8C7D', fontSize: 10, fontWeight: '800', letterSpacing: .8 }, aiMessage: { color: '#385B52', fontSize: 13, lineHeight: 20, marginTop: 9 }, doneButton: { backgroundColor: '#1F6B62', borderRadius: 14, marginTop: 20, padding: 16, width: '100%' }, doneButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  modalBackdrop: { backgroundColor: 'rgba(20,46,40,.34)', flex: 1, justifyContent: 'flex-end' }, voiceSheet: { backgroundColor: '#FCFBF7', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 32 }, sheetHandle: { alignSelf: 'center', backgroundColor: '#D4DDD8', borderRadius: 99, height: 4, marginBottom: 17, width: 42 }, sheetIcon: { alignItems: 'center', backgroundColor: '#DCEBE3', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 }, sheetTitle: { color: '#24443E', fontSize: 21, fontWeight: '800', marginTop: 13 }, sheetCopy: { color: '#6B7D78', fontSize: 12.5, lineHeight: 19, marginTop: 6 }, listenButton: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 18, padding: 15 }, listenActive: { backgroundColor: '#BD604D' }, listenText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }, orLabel: { color: '#94A19D', fontSize: 9.5, fontWeight: '800', letterSpacing: 1, marginTop: 17, textAlign: 'center' }, voiceInput: { backgroundColor: '#F6F8F5', borderColor: '#DCE5E0', borderRadius: 14, borderWidth: 1, color: '#24443E', fontSize: 13.5, height: 92, lineHeight: 19, marginTop: 10, padding: 13 }, voiceNotice: { color: '#B45A4A', fontSize: 11.5, lineHeight: 17, marginTop: 9 }, analyzeButton: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 13, minHeight: 51 }, analyzeText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
});
