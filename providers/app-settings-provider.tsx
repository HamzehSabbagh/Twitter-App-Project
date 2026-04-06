import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

type ThemeMode = "light" | "dark";
type LanguageCode = "en" | "ar";
type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSoft: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accentText: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  successBg: string;
  successBorder: string;
  successText: string;
};

type AppSettingsContextValue = {
  theme: ThemeMode;
  language: LanguageCode;
  isRTL: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
};

const STORAGE_THEME_KEY = "twitter_theme";
const STORAGE_LANGUAGE_KEY = "twitter_language";

const themeColors: Record<ThemeMode, ThemeColors> = {
  dark: {
    background: "#020617",
    surface: "#0F172A",
    surfaceAlt: "#111827",
    border: "#1E293B",
    borderSoft: "rgba(255,255,255,0.12)",
    text: "#FFFFFF",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    inputBg: "rgba(2,6,23,0.72)",
    inputBorder: "rgba(255,255,255,0.2)",
    primary: "#22D3EE",
    primaryText: "#082F49",
    primarySoft: "rgba(34,211,238,0.12)",
    accentText: "#67E8F9",
    dangerBg: "rgba(244,63,94,0.10)",
    dangerBorder: "rgba(244,63,94,0.30)",
    dangerText: "#FDA4AF",
    successBg: "rgba(16,185,129,0.15)",
    successBorder: "rgba(16,185,129,0.30)",
    successText: "#A7F3D0",
  },
  light: {
    background: "#F4F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EFF6FF",
    border: "#D8E1EC",
    borderSoft: "#D8E1EC",
    text: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    inputBg: "#FFFFFF",
    inputBorder: "#CBD5E1",
    primary: "#06B6D4",
    primaryText: "#083344",
    primarySoft: "#CFFAFE",
    accentText: "#0891B2",
    dangerBg: "#FFE4E6",
    dangerBorder: "#FDA4AF",
    dangerText: "#BE123C",
    successBg: "#D1FAE5",
    successBorder: "#6EE7B7",
    successText: "#065F46",
  },
};

const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    app_name: "Twitter",
    profile: "Profile",
    settings: "Settings",
    logout: "Log out",
    login: "Log in",
    register: "Register",
    create_account: "Create account",
    edit_profile: "Edit profile",
    edit_post: "Edit post",
    delete_post: "Delete post",
    save_changes: "Save changes",
    back: "Back",
    back_home: "Back to Home",
    navigation: "Navigation",
    home: "Home",
    explore: "Explore",
    notifications: "Notifications",
    timeline: "Timeline",
    timeline_description:
      "Share updates, media, and threaded conversations from one place.",
    create_post: "Create a post",
    create_post_description:
      "Open the composer to add text, pictures, videos, and audio.",
    new_post: "New post",
    discover: "Discover",
    no_hashtags: "No hashtags yet.",
    unread: "unread",
    mark_all_read: "Mark all read",
    notifications_title: "Your activity inbox",
    notifications_description:
      "Follow events, likes, replies, reposts, and mentions all land here.",
    quick_return: "Quick return",
    settings_title: "App settings",
    settings_description:
      "Choose how the interface looks and which language to use for the app shell.",
    theme: "Theme",
    language: "Language",
    light: "Light",
    dark: "Dark",
    english: "English",
    arabic: "Arabic",
    preview: "Preview",
    settings_saved_local:
      "These settings are stored locally on this device for now.",
    sign_in_required: "You need to log in first.",
    welcome_back: "Welcome back",
    sign_in_account: "Sign in to your account",
    continue_left_off: "Continue where you left off.",
    email_verified_sign_in: "Your email has been verified. You can sign in now.",
    email: "Email",
    password: "Password",
    enter_password: "Enter your password",
    hide: "Hide",
    show: "Show",
    new_here: "New here?",
    join_now: "Join now",
    create_your_account: "Create your account",
    setup_profile_start: "Set up your profile and start using the app.",
    first_name: "First name",
    last_name: "Last name",
    username: "Username",
    choose_valid_birth_date: "Please choose a valid birth date.",
    must_be_18_create: "You must be 18 or older to create an account.",
    must_be_18_use: "You must be 18 or older to use this app.",
    create_password: "Create a password",
    confirm_password: "Confirm password",
    repeat_password: "Repeat your password",
    already_have_account: "Already have an account?",
    one_more_step: "One more step",
    check_inbox: "Check your inbox",
    check_inbox_description:
      "Check your inbox and click the verification link we sent. If it did not arrive, request a new one below.",
    missing_email_address: "Missing email address.",
    account_exists_unverified:
      "Your account exists, but your email address is not verified yet.",
    resend_verification_email: "Resend verification email",
    could_not_resend_verification_email:
      "Could not resend verification email.",
    social_platform: "Social Platform",
    guest_hero_title: "Share updates, follow people, and build your timeline",
    guest_hero_description:
      "A clean Twitter-like experience built from your Laravel web app and mirrored here on mobile.",
    features: "Features",
    posts: "Posts",
    media_support: "Media support",
    discover_hashtags: "Discover hashtags",
    fast_timeline: "Fast timeline",
    fast_timeline_description: "Posts, reposts, and comments in one place.",
    media_support_description: "Attach photos, video, and audio to posts.",
    discover_hashtags_description: "Track topics and join conversations quickly.",
    compose_fast: "Compose fast",
    reply_in_context: "Reply in context",
    boost_ideas: "Boost ideas",
    discover_trends: "Discover trends",
    composer: "Composer",
    share_updates_build_timeline: "Share updates and build your timeline",
    clean_mobile_experience:
      "A clean Twitter-like mobile experience inspired by your Laravel project.",
    loading_posts: "Loading posts...",
    no_posts_yet: "No posts yet. Create the first one.",
    create_post_screen_title: "Create post",
    create_post_screen_description:
      "Publish a new post or enter a parent post ID to make it part of a thread.",
    content: "Content",
    what_is_happening: "What is happening?",
    parent_post_id: "Parent post ID",
    optional: "Optional",
    attach_media: "Attach media",
    add_picture: "Add picture",
    add_video: "Add video",
    add_audio: "Add audio",
    selected_files: "Selected files",
    new_files: "New files",
    clear: "Clear",
    publish_post: "Publish post",
    post_created: "Post created",
    post_created_success: "Your post was submitted successfully.",
    publish_failed: "Publish failed",
    missing_content_title: "Missing content",
    write_something_attach_file: "Write something or attach at least one file.",
    too_many_files: "Too many files",
    file_too_large: "File too large",
    max_4_files: "You can upload up to 4 files per post.",
    bigger_than_50mb: "is larger than 50 MB.",
    explore_label: "Explore",
    discover_moving: "Discover what is moving",
    browse_trending_description:
      "Browse trending hashtags, suggested accounts, and the most active posts across the app.",
    search_users_posts_hashtags: "Search users, posts, hashtags",
    suggested_users: "Suggested users",
    no_suggested_users_match: "No suggested users match your search.",
    followers: "followers",
    following: "Following",
    view: "View",
    trending_hashtags: "Trending hashtags",
    no_hashtags_match: "No hashtags match your search.",
    popular_posts: "Popular posts",
    results: "result(s)",
    unknown_date: "Unknown date",
    media_only_post: "Media-only post",
    likes: "likes",
    comments: "comments",
    reposts: "reposts",
    no_posts_match_search: "No posts match your search yet.",
    profile_private: "This profile is private.",
    could_not_load_profile: "Could not load profile.",
    could_not_update_follow: "Could not update follow.",
    follow: "Follow",
    unfollow: "Unfollow",
    this_user_has_not_posted: "This user has not posted yet.",
    delete_post_confirm: "Are you sure you want to delete this post?",
    cancel: "Cancel",
    edit_your_profile: "Edit your profile",
    update_profile_description:
      "Update the same profile details you use in the web app.",
    location: "Location",
    bio: "Bio",
    tell_about_yourself: "Tell people about yourself",
    public_profile: "Public profile",
    public_profile_description:
      "Turn this off if you want only yourself and admins to see your posts.",
    could_not_update_profile: "Could not update your profile.",
    current_media: "Current media",
    remove: "Remove",
    add_more_media: "Add more media",
    post_updated: "Post updated",
    post_updated_success: "Your changes were saved successfully.",
    update_failed: "Update failed",
    could_not_update_post: "Could not update post.",
    delete_post_irreversible:
      "Are you sure you want to delete this post? This cannot be undone.",
    post_deleted: "Post deleted",
    post_deleted_success: "Your post was deleted successfully.",
    delete_failed: "Delete failed",
    could_not_delete_post: "Could not delete post.",
    post_details: "Post details",
    post_details_description:
      "Review the full post and its conversation in one place.",
    no_text_content: "This post has no text content.",
    add_comment: "Add a comment",
    write_reply: "Write a reply",
    post_comment: "Post comment",
    no_comments_yet: "No comments yet. Start the conversation.",
    birth_date: "Birth date",
    select_birth_date: "Select your birth date",
    age_requirement: "You must be 18 or older to create an account.",
    edit_post_description:
      "Update the text, keep attachments, remove old ones, or add new media.",
  },
  ar: {
    app_name: "تويتر",
    profile: "الملف الشخصي",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    create_account: "إنشاء حساب",
    edit_profile: "تعديل الملف الشخصي",
    edit_post: "تعديل المنشور",
    delete_post: "حذف المنشور",
    save_changes: "حفظ التغييرات",
    back: "رجوع",
    back_home: "العودة للصفحة الرئيسية",
    navigation: "التنقل",
    home: "الرئيسية",
    explore: "الاستكشاف",
    notifications: "الإشعارات",
    timeline: "الخط الزمني",
    timeline_description: "شارك التحديثات والوسائط والمحادثات المتسلسلة من مكان واحد.",
    create_post: "إنشاء منشور",
    create_post_description: "افتح أداة النشر لإضافة نصوص وصور وفيديو وصوت.",
    new_post: "منشور جديد",
    discover: "اكتشف",
    no_hashtags: "لا توجد وسوم حتى الآن.",
    unread: "غير مقروء",
    mark_all_read: "تحديد الكل كمقروء",
    notifications_title: "صندوق نشاطك",
    notifications_description: "تظهر هنا المتابعات والإعجابات والردود وإعادات النشر والإشارات.",
    quick_return: "عودة سريعة",
    settings_title: "إعدادات التطبيق",
    settings_description: "اختر شكل الواجهة واللغة المستخدمة في أجزاء التطبيق الأساسية.",
    theme: "المظهر",
    language: "اللغة",
    light: "فاتح",
    dark: "داكن",
    english: "الإنجليزية",
    arabic: "العربية",
    preview: "معاينة",
    settings_saved_local: "يتم حفظ هذه الإعدادات محلياً على هذا الجهاز حالياً.",
    sign_in_required: "يجب تسجيل الدخول أولاً.",
    welcome_back: "أهلاً بعودتك",
    sign_in_account: "سجل الدخول إلى حسابك",
    continue_left_off: "أكمل من حيث توقفت.",
    email_verified_sign_in: "تم توثيق بريدك الإلكتروني. يمكنك تسجيل الدخول الآن.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    enter_password: "أدخل كلمة المرور",
    hide: "إخفاء",
    show: "إظهار",
    new_here: "جديد هنا؟",
    join_now: "انضم الآن",
    create_your_account: "أنشئ حسابك",
    setup_profile_start: "جهز ملفك الشخصي وابدأ استخدام التطبيق.",
    first_name: "الاسم الأول",
    last_name: "اسم العائلة",
    username: "اسم المستخدم",
    choose_valid_birth_date: "يرجى اختيار تاريخ ميلاد صحيح.",
    must_be_18_create: "يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب.",
    must_be_18_use: "يجب أن يكون عمرك 18 سنة أو أكثر لاستخدام هذا التطبيق.",
    create_password: "أنشئ كلمة مرور",
    confirm_password: "تأكيد كلمة المرور",
    repeat_password: "أعد كتابة كلمة المرور",
    already_have_account: "لديك حساب بالفعل؟",
    one_more_step: "خطوة أخيرة",
    check_inbox: "تحقق من بريدك",
    check_inbox_description:
      "افتح بريدك واضغط على رابط التحقق الذي أرسلناه. إذا لم يصلك البريد يمكنك طلب رسالة جديدة من الأسفل.",
    missing_email_address: "عنوان البريد الإلكتروني مفقود.",
    account_exists_unverified: "الحساب موجود لكن البريد الإلكتروني غير موثق بعد.",
    resend_verification_email: "إعادة إرسال رسالة التحقق",
    could_not_resend_verification_email: "تعذر إعادة إرسال رسالة التحقق.",
    social_platform: "منصة اجتماعية",
    guest_hero_title: "شارك التحديثات وتابع الأشخاص وابنِ خطك الزمني",
    guest_hero_description:
      "تجربة شبيهة بتويتر مبنية على مشروع Laravel الخاص بك ومطابقة هنا على الجوال.",
    features: "المزايا",
    posts: "المنشورات",
    media_support: "دعم الوسائط",
    discover_hashtags: "اكتشاف الوسوم",
    fast_timeline: "خط زمني سريع",
    fast_timeline_description: "المنشورات وإعادات النشر والتعليقات في مكان واحد.",
    media_support_description: "أضف الصور والفيديو والصوت إلى المنشورات.",
    discover_hashtags_description: "تابع المواضيع وشارك في المحادثات بسرعة.",
    compose_fast: "إنشاء سريع",
    reply_in_context: "ردود في السياق",
    boost_ideas: "عزز الأفكار",
    discover_trends: "اكتشف الترند",
    composer: "المنشئ",
    share_updates_build_timeline: "شارك التحديثات وابنِ خطك الزمني",
    clean_mobile_experience: "تجربة جوال شبيهة بتويتر مستوحاة من مشروع Laravel الخاص بك.",
    loading_posts: "جاري تحميل المنشورات...",
    no_posts_yet: "لا توجد منشورات بعد. أنشئ أول منشور.",
    create_post_screen_title: "إنشاء منشور",
    create_post_screen_description: "انشر منشوراً جديداً أو أدخل رقم منشور أب ليصبح جزءاً من سلسلة.",
    content: "المحتوى",
    what_is_happening: "ماذا يحدث؟",
    parent_post_id: "معرف المنشور الأب",
    optional: "اختياري",
    attach_media: "إرفاق وسائط",
    add_picture: "إضافة صورة",
    add_video: "إضافة فيديو",
    add_audio: "إضافة صوت",
    selected_files: "الملفات المحددة",
    new_files: "ملفات جديدة",
    clear: "مسح",
    publish_post: "نشر المنشور",
    post_created: "تم إنشاء المنشور",
    post_created_success: "تم إرسال منشورك بنجاح.",
    publish_failed: "فشل النشر",
    missing_content_title: "محتوى مفقود",
    write_something_attach_file: "اكتب شيئاً أو أرفق ملفاً واحداً على الأقل.",
    too_many_files: "عدد الملفات كبير",
    file_too_large: "الملف كبير جداً",
    max_4_files: "يمكنك رفع 4 ملفات كحد أقصى لكل منشور.",
    bigger_than_50mb: "أكبر من 50 ميغابايت.",
    explore_label: "استكشاف",
    discover_moving: "اكتشف ما يتحرك الآن",
    browse_trending_description: "تصفح الوسوم الرائجة والحسابات المقترحة وأكثر المنشورات نشاطاً في التطبيق.",
    search_users_posts_hashtags: "ابحث عن مستخدمين أو منشورات أو وسوم",
    suggested_users: "حسابات مقترحة",
    no_suggested_users_match: "لا توجد حسابات مقترحة تطابق بحثك.",
    followers: "متابعون",
    following: "يتابع",
    view: "عرض",
    trending_hashtags: "الوسوم الرائجة",
    no_hashtags_match: "لا توجد وسوم تطابق بحثك.",
    popular_posts: "منشورات شائعة",
    results: "نتيجة",
    unknown_date: "تاريخ غير معروف",
    media_only_post: "منشور وسائط فقط",
    likes: "إعجاب",
    comments: "تعليق",
    reposts: "إعادة نشر",
    no_posts_match_search: "لا توجد منشورات تطابق بحثك بعد.",
    profile_private: "هذا الملف الشخصي خاص.",
    could_not_load_profile: "تعذر تحميل الملف الشخصي.",
    could_not_update_follow: "تعذر تحديث المتابعة.",
    follow: "متابعة",
    unfollow: "إلغاء المتابعة",
    this_user_has_not_posted: "هذا المستخدم لم ينشر بعد.",
    delete_post_confirm: "هل أنت متأكد من حذف هذا المنشور؟",
    cancel: "إلغاء",
    edit_your_profile: "عدّل ملفك الشخصي",
    update_profile_description: "حدّث نفس تفاصيل الملف الشخصي التي تستخدمها في نسخة الويب.",
    location: "الموقع",
    bio: "النبذة",
    tell_about_yourself: "عرّف الناس بنفسك",
    public_profile: "ملف شخصي عام",
    public_profile_description: "أوقف هذا الخيار إذا كنت تريد أن يرى منشوراتك أنت والمشرفون فقط.",
    could_not_update_profile: "تعذر تحديث ملفك الشخصي.",
    current_media: "الوسائط الحالية",
    remove: "إزالة",
    add_more_media: "إضافة وسائط أخرى",
    post_updated: "تم تحديث المنشور",
    post_updated_success: "تم حفظ تغييراتك بنجاح.",
    update_failed: "فشل التحديث",
    could_not_update_post: "تعذر تحديث المنشور.",
    delete_post_irreversible: "هل أنت متأكد من حذف هذا المنشور؟ لا يمكن التراجع عن هذا الإجراء.",
    post_deleted: "تم حذف المنشور",
    post_deleted_success: "تم حذف منشورك بنجاح.",
    delete_failed: "فشل الحذف",
    could_not_delete_post: "تعذر حذف المنشور.",
    post_details: "تفاصيل المنشور",
    post_details_description: "راجع المنشور الكامل والمحادثة الخاصة به في مكان واحد.",
    no_text_content: "هذا المنشور لا يحتوي على نص.",
    add_comment: "أضف تعليقاً",
    write_reply: "اكتب رداً",
    post_comment: "نشر التعليق",
    no_comments_yet: "لا توجد تعليقات بعد. ابدأ المحادثة.",
    birth_date: "تاريخ الميلاد",
    select_birth_date: "اختر تاريخ ميلادك",
    age_requirement: "يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب.",
    edit_post_description: "حدّث النص واحتفظ بالمرفقات أو أزل القديمة أو أضف وسائط جديدة.",
  },
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    async function restoreSettings() {
      const [storedTheme, storedLanguage] = await Promise.all([
        AsyncStorage.getItem(STORAGE_THEME_KEY),
        AsyncStorage.getItem(STORAGE_LANGUAGE_KEY),
      ]);

      if (storedTheme === "light" || storedTheme === "dark") {
        setThemeState(storedTheme);
      }

      if (storedLanguage === "en" || storedLanguage === "ar") {
        setLanguageState(storedLanguage);
      }
    }

    restoreSettings();
  }, []);

  const isAdmin = user?.role?.name?.toLowerCase() === "admin";
  const resolvedColors = isAdmin
    ? {
        ...themeColors[theme],
        primary: theme === "dark" ? "#DC2626" : "#C2410C",
        primaryText: "#FFF7F7",
        primarySoft: theme === "dark" ? "rgba(220,38,38,0.18)" : "#FEE2E2",
        accentText: theme === "dark" ? "#FCA5A5" : "#B91C1C",
        surfaceAlt: theme === "dark" ? "#1F1120" : "#FFF1F2",
        borderSoft: theme === "dark" ? "rgba(248,113,113,0.22)" : "#FBCFE8",
        dangerBg: theme === "dark" ? "rgba(190,24,93,0.14)" : "#FFE4E6",
        dangerBorder: theme === "dark" ? "rgba(244,114,182,0.28)" : "#FDA4AF",
        dangerText: theme === "dark" ? "#FDA4AF" : "#BE123C",
      }
    : themeColors[theme];

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      theme,
      language,
      isRTL: language === "ar",
      colors: resolvedColors,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        AsyncStorage.setItem(STORAGE_THEME_KEY, nextTheme);
      },
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        AsyncStorage.setItem(STORAGE_LANGUAGE_KEY, nextLanguage);
      },
      t: (key, fallback) => translations[language][key] ?? fallback ?? key,
    }),
    [language, resolvedColors, theme]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }

  return context;
}
