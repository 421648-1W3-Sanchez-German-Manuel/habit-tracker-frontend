import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuthStore } from '../store/authStore';
import type { LoginFormErrors } from '../types/auth';
import { useNavigation } from '@react-navigation/native';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateLoginForm = (email: string, password: string): LoginFormErrors => {
  const errors: LoginFormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email';
  }

  if (!password.trim()) {
    errors.password = 'Password is required';
  }

  return errors;
};

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});

  const navigation = useNavigation();
  const loading = useAuthStore((state) => state.loading);
  const apiError = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const clearError = useAuthStore((state) => state.clearError);

  const onSubmit = async () => {
    const errors = validateLoginForm(email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    clearError();
    await login({
      email: email.trim(),
      password,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (fieldErrors.email) {
              setFieldErrors((previous) => ({ ...previous, email: undefined }));
            }
          }}
          error={fieldErrors.email}
        />

        <Input
          label="Password"
          placeholder="Your password"
          secureTextEntry
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (fieldErrors.password) {
              setFieldErrors((previous) => ({ ...previous, password: undefined }));
            }
          }}
          error={fieldErrors.password}
        />

        <Button title="Sign in" onPress={onSubmit} loading={loading} />
        <Text style={{ marginTop: 16, textAlign: 'center' }}>
          Don't have an account?{' '}
          <Text
            style={{ color: '#007bff', textDecorationLine: 'underline' }}
            onPress={() => navigation.navigate('Register' as never)}
          >
            Register here.
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  apiError: {
    marginBottom: 16,
    color: '#b91c1c',
    fontSize: 14,
  },
});
