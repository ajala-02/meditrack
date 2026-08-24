import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

const REASSURANCE_POINTS = [
  'Daily check-ins take under 2 minutes',
  'Your care team stays in the loop',
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeFocused, setIsCodeFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !joinCode.trim()) {
      setError('Enter your email and recovery code to continue.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(email.trim().toLowerCase(), joinCode.trim());
    } catch (err) {
      setError(err.response?.data?.message || 'We could not sign you in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.hero}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <FontAwesome5 name="heart" size={16} color="#FFFFFF" solid />
                  <View style={styles.brandMarkCross} />
                </View>
                <Text style={styles.brandName}>Medi<Text style={styles.brandNameAccent}>Track</Text></Text>
              </View>

              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>POST-DISCHARGE CARE</Text>
              </View>
              <Text style={styles.headline}>Recovery feels better{`\n`}with someone beside you.</Text>
              <Text style={styles.heroCopy}>
                A calmer way to stay connected with your care team after leaving the hospital.
              </Text>

              <View style={styles.reassuranceCard}>
                <View style={styles.reassuranceIcon}>
                  <Feather name="shield" size={19} color="#1F6B62" />
                </View>
                <View style={styles.reassuranceTextArea}>
                  {REASSURANCE_POINTS.map((point) => (
                    <View key={point} style={styles.reassuranceLine}>
                      <Feather name="check" size={14} color="#2F8C7D" />
                      <Text style={styles.reassuranceText}>{point}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>Welcome back</Text>
                <Text style={styles.formSubtitle}>Sign in to see today’s recovery plan.</Text>
              </View>

              {error ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Feather name="alert-circle" size={18} color="#B6483C" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email address</Text>
                <View style={styles.inputShell}>
                  <Feather name="mail" size={19} color="#6C7C78" />
                  <TextInput
                    accessibilityLabel="Email address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9AA8A5"
                    style={styles.input}
                    textContentType="emailAddress"
                    value={email}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Recovery code</Text>
                  <Text style={styles.labelHint}>From your hospital</Text>
                </View>
                <View style={[styles.inputShell, isCodeFocused && styles.inputShellFocused]}>
                  <Feather name="key" size={19} color={isCodeFocused ? '#1F6B62' : '#6C7C78'} />
                  <TextInput
                    accessibilityLabel="Recovery code"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={10}
                    onBlur={() => setIsCodeFocused(false)}
                    onChangeText={setJoinCode}
                    onFocus={() => setIsCodeFocused(true)}
                    placeholder="Enter your code"
                    placeholderTextColor="#9AA8A5"
                    style={[styles.input, styles.codeInput]}
                    value={joinCode}
                  />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={handleLogin}
                style={({ pressed }) => [styles.button, (pressed || isLoading) && styles.buttonPressed]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Continue to my recovery</Text>
                    <Feather name="arrow-right" size={19} color="#FFFFFF" />
                  </>
                )}
              </Pressable>

              <View style={styles.helpRow}>
                <Feather name="help-circle" size={16} color="#5D716D" />
                <Text style={styles.helpText}>Need your recovery code? </Text>
                <Text style={styles.helpAction}>Contact your hospital</Text>
              </View>
            </View>

            <Text style={styles.privacyNote}>
              <Feather name="lock" size={12} color="#82918E" />{'  '}Your health information is securely protected.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F6F4EE' },
  scrollContent: { flexGrow: 1 },
  page: { flex: 1, minHeight: '100%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  hero: { paddingHorizontal: 4, paddingTop: 6 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandMark: {
    alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, height: 42,
    justifyContent: 'center', overflow: 'hidden', width: 42,
  },
  brandMarkCross: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, height: 34, position: 'absolute', right: -17, top: -13, width: 34 },
  brandName: { color: '#173B36', fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  brandNameAccent: { color: '#2F8C7D' },
  badge: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 32 },
  badgeDot: { backgroundColor: '#E58D60', borderRadius: 99, height: 7, width: 7 },
  badgeText: { color: '#9A6042', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  headline: { color: '#173B36', fontSize: 31, fontWeight: '800', letterSpacing: -1.15, lineHeight: 37, marginTop: 11 },
  heroCopy: { color: '#60726E', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 330 },
  reassuranceCard: {
    alignItems: 'center', backgroundColor: '#E6F0EA', borderColor: '#D6E5DC', borderRadius: 17,
    borderWidth: 1, flexDirection: 'row', marginTop: 23, padding: 13,
  },
  reassuranceIcon: { alignItems: 'center', backgroundColor: '#D4E7DC', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  reassuranceTextArea: { gap: 5, marginLeft: 11 },
  reassuranceLine: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  reassuranceText: { color: '#3C5D56', fontSize: 12.5, fontWeight: '600' },
  formCard: {
    backgroundColor: '#FFFFFF', borderColor: '#E8E7E1', borderRadius: 24, borderWidth: 1,
    marginTop: 26, padding: 21, shadowColor: '#29443E', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.08, shadowRadius: 16,
  },
  formHeading: { marginBottom: 21 },
  formTitle: { color: '#173B36', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  formSubtitle: { color: '#70807D', fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  errorBox: { alignItems: 'center', backgroundColor: '#FFF1EF', borderColor: '#F3D0C9', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 18, padding: 12 },
  errorText: { color: '#8E3C33', flex: 1, fontSize: 12.5, lineHeight: 18 },
  fieldGroup: { marginBottom: 17 },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#36514C', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  labelHint: { color: '#879591', fontSize: 11.5, marginBottom: 8 },
  inputShell: { alignItems: 'center', backgroundColor: '#F8FAF8', borderColor: '#DCE5E0', borderRadius: 13, borderWidth: 1, flexDirection: 'row', height: 52, paddingHorizontal: 14 },
  inputShellFocused: { backgroundColor: '#FFFFFF', borderColor: '#2F8C7D', shadowColor: '#2F8C7D', shadowOpacity: 0.12, shadowRadius: 7 },
  input: { color: '#1D3E39', flex: 1, fontSize: 15, height: '100%', marginLeft: 11 },
  codeInput: { fontWeight: '700', letterSpacing: 1.3 },
  button: { alignItems: 'center', backgroundColor: '#1F6B62', borderRadius: 14, flexDirection: 'row', gap: 10, height: 55, justifyContent: 'center', marginTop: 5, shadowColor: '#1F6B62', shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.22, shadowRadius: 10 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  helpRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 },
  helpText: { color: '#70817D', fontSize: 12 },
  helpAction: { color: '#1F6B62', fontSize: 12, fontWeight: '700' },
  privacyNote: { alignItems: 'center', color: '#82918E', fontSize: 11.5, lineHeight: 18, marginTop: 19, textAlign: 'center' },
});
