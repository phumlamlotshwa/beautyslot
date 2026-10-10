import { Linking, ScrollView, Text, View } from 'react-native';
import { CONTACT_EMAIL } from '../lib/contact';
import { fonts, spacing } from '../lib/theme';
import { makeStyles } from '../lib/theme-context';
import { useUi } from '../lib/ui';

type Section = { title: string; body: string[] };

const UPDATED = '10 October 2026';

const sections: Section[] = [
  {
    title: 'Who we are',
    body: [
      'BeautySlot is run by Phumla Mlotshwa in Mbombela, South Africa. Phumla is responsible for your information and is the information officer under POPIA.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Your name, email address and password. Your password is stored securely and nobody at BeautySlot can see it.',
      'If you are a professional: what you do, your services and prices, working hours, business address, house call prices, and the names, photos and roles of your team.',
      'Photos you add: profile photos, photos of your work and photos you attach to a booking.',
      'Addresses you save, and the address for each house call.',
      'Your bookings, including times, prices, their status and any reasons given for changes.',
      'Messages you send in chats.',
      'Your location, only while the app is open and only if you allow it. It is used to show professionals near you and is not saved.',
    ],
  },
  {
    title: 'What we do not do',
    body: ['We do not sell your information, show ads or use tracking or analytics tools.'],
  },
  {
    title: 'How we use it',
    body: [
      'To create your account and send you sign-in and password codes, show professionals and their work, handle bookings and changes, let you message the people you book with, and work out distances, call-out fees and travel times.',
    ],
  },
  {
    title: 'Who can see what',
    body: [
      "Anyone using BeautySlot, with or without an account, can see a professional's name, area, services, prices, work photos and team.",
      "A professional's full address is only shown to customers with a confirmed booking at their place.",
      "A customer's name and photo are only shown to professionals they have booked or messaged.",
      'A house call address is only shown to the professional for that booking.',
      'Photos you attach to a booking are only shown to you and that professional.',
      'Messages are only seen by the two people in the chat.',
    ],
  },
  {
    title: 'Services we use',
    body: [
      'Supabase stores our data and photos and handles sign-in. Its servers may be outside South Africa.',
      'Google Maps Platform is used for address search, locations and driving times, so addresses and map points are sent to Google.',
      'Gmail is used to send emails with your codes.',
      "Your phone's own maps service (Apple or Google) is used to name the area you are in.",
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your information until you delete your account. You can do that any time from your profile.',
      "When a customer deletes their account, their profile, photos, addresses and messages are deleted. Past bookings stay in the professional's records without the customer's name.",
      'When a professional deletes their account, everything is deleted, including their services, photos, team and bookings.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You can ask to see the information we hold about you, have it corrected or deleted, or object to how it is used. Email us and we will reply within 30 days.',
      'If you are unhappy with how we handle your information, you can complain to the Information Regulator at inforegulator.org.za.',
    ],
  },
  {
    title: 'Children',
    body: [
      'BeautySlot is for people aged 18 and over. If you think someone younger has an account, email us and we will delete it.',
    ],
  },
  {
    title: 'Keeping it safe',
    body: [
      'Everything sent between the app and our servers is encrypted, and rules on our database stop people from seeing information that is not theirs.',
    ],
  },
  {
    title: 'Changes',
    body: [
      'If this policy changes, the date at the top changes too. If it is a big change, we will tell you in the app.',
    ],
  },
];

export default function Privacy() {
  const ui = useUi();
  const styles = useStyles();

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Privacy policy</Text>
      <Text style={styles.updated}>Updated {UPDATED}</Text>

      {sections.map((section) => (
        <View key={section.title}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.paragraph}>
        Email{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
          {CONTACT_EMAIL}
        </Text>
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  updated: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  paragraph: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: spacing.sm },
  link: { fontFamily: fonts.semiBold, textDecorationLine: 'underline' },
}));