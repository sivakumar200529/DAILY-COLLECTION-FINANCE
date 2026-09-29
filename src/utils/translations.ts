export type Language = 'en' | 'ta';

export const translations: Record<string, { en: string; ta: string }> = {
  // Brand & Application
  appName: {
    en: 'DAILY COLLECTION',
    ta: 'தினசரி வசூல்',
  },
  appTagline: {
    en: 'Microfinance & Loan Management',
    ta: 'மைக்ரோஃபைனான்ஸ் & கடன் மேலாண்மை',
  },
  location: {
    en: 'chennai, Tamil Nadu',
    ta: 'சென்னை, தமிழ்நாடு',
  },
  copyright: {
    en: '© 2026 DAILY COLLECTION • chennai, Tamil Nadu',
    ta: '© 2026 தினசரி வசூல் • சென்னை, தமிழ்நாடு',
  },

  // Navigation Items
  dashboard: {
    en: 'Dashboard',
    ta: 'முகப்பு பலகை',
  },
  customers: {
    en: 'Customers',
    ta: 'வாடிக்கையாளர்கள்',
  },
  accounts: {
    en: 'Collection Accounts',
    ta: 'கடன் கணக்குகள்',
  },
  dailyCollections: {
    en: 'Daily Collections',
    ta: 'தினசரி வசூல்',
  },
  dailyRegister: {
    en: 'Daily Register',
    ta: 'தினசரி பதிவேடு',
  },
  monthlyReport: {
    en: 'Monthly Excel Register',
    ta: 'மாதாந்திர பதிவேடு',
  },
  monthlyMatrix: {
    en: 'Monthly Matrix Register',
    ta: 'மாதாந்திர வசூல் மேட்ரிக்ஸ்',
  },
  receipts: {
    en: 'Receipts',
    ta: 'ரசீதுகள்',
  },
  receiptsMaster: {
    en: 'Receipts Master',
    ta: 'ரசீதுகள் மேலாண்மை',
  },
  collectors: {
    en: 'Collectors',
    ta: 'வசூலிப்பாளர்கள்',
  },
  areas: {
    en: 'Areas',
    ta: 'பகுதிகள்',
  },
  documents: {
    en: 'Documents',
    ta: 'ஆவணங்கள்',
  },
  plans: {
    en: 'Collection Plans',
    ta: 'கடன் திட்டங்கள்',
  },
  reports: {
    en: 'Reports',
    ta: 'அறிக்கைகள்',
  },
  collectionReports: {
    en: 'Collection Reports',
    ta: 'வசூல் அறிக்கைகள்',
  },
  notifications: {
    en: 'Notifications',
    ta: 'அறிவிப்புகள்',
  },
  settings: {
    en: 'Settings',
    ta: 'அமைப்புகள்',
  },
  systemSettings: {
    en: 'System Settings',
    ta: 'கணினி அமைப்புகள்',
  },
  logout: {
    en: 'Logout',
    ta: 'வெளியேறு',
  },

  // Customer Portal Navigation
  myCollection: {
    en: 'My Collection',
    ta: 'என் கடன் கணக்கு',
  },
  paymentHistory: {
    en: 'Payment History',
    ta: 'கட்டண வரலாறு',
  },
  myReceipts: {
    en: 'My Receipts',
    ta: 'என் ரசீதுகள்',
  },
  myDocuments: {
    en: 'My Documents',
    ta: 'என் ஆவணங்கள்',
  },
  myProfile: {
    en: 'My Profile',
    ta: 'என் சுயவிவரம்',
  },

  // Roles & Badges
  roleAdmin: {
    en: '1. ADMIN',
    ta: '1. நிர்வாகி',
  },
  roleAgent: {
    en: '2. AGENT',
    ta: '2. வசூல் முகவர்',
  },
  roleCustomer: {
    en: '3. CUSTOMER',
    ta: '3. வாடிக்கையாளர்',
  },
  adminTitle: {
    en: '1. Administrator (Can Do Anything)',
    ta: '1. முழு நிர்வாகி (அனைத்து அணுகல்)',
  },
  agentTitle: {
    en: '2. Collection Agent (Collect & Reports)',
    ta: '2. வசூல் முகவர் (வசூல் & அறிக்கைகள்)',
  },
  customerTitle: {
    en: '3. Customer Portal (Passbook & Pay)',
    ta: '3. வாடிக்கையாளர் போர்டல் (பாஸ்புக் & கட்டணம்)',
  },
  adminDesc: {
    en: 'Full master controls: Edit/delete accounts, plans, settings, audits & customers',
    ta: 'முழு முதன்மை கட்டுப்பாடுகள்: கணக்குகள், திட்டங்கள், அமைப்புகள், வாடிக்கையாளர்களைத் திருத்து/நீக்கு',
  },
  agentDesc: {
    en: 'Field agent workspace: Collect doorstep dues, 1-tap collect & reports',
    ta: 'கள முகவர் பணியிடம்: வீடு/கடை சென்று தவணை வசூல், 1-தட்டல் வசூல் & அறிக்கைகள்',
  },
  customerDesc: {
    en: 'Customer passbook: Track repayments, view receipts & pay via UPI/Netbanking',
    ta: 'வாடிக்கையாளர் பாஸ்புக்: தவணைகளைக் கண்காணிக்க, ரசீதுகளைப் பார்க்க & UPI மூலம் செலுத்த',
  },
  masterAdmin: {
    en: '👑 Master Admin',
    ta: '👑 முதன்மை நிர்வாகி',
  },
  fieldAgent: {
    en: '🚶 Field Agent',
    ta: '🚶 கள வசூல் முகவர்',
  },
  customerPill: {
    en: '👤 Customer',
    ta: '👤 வாடிக்கையாளர்',
  },
  fieldAgentBanner: {
    en: 'Field Collection Agent',
    ta: 'கள வசூல் முகவர்',
  },
  doorstepCollectionBanner: {
    en: 'Doorstep Collections & Reports',
    ta: 'நேரடி வசூல் & கள அறிக்கைகள்',
  },
  customerSelfService: {
    en: 'Customer Self-Service',
    ta: 'வாடிக்கையாளர் தன்னாட்சி',
  },
  adminOperations: {
    en: 'Admin Operations',
    ta: 'நிர்வாக செயல்பாடுகள்',
  },

  // Actions & Buttons
  collectPayment: {
    en: 'Collect Payment',
    ta: 'பணம் வசூலிக்கவும்',
  },
  quickCollect: {
    en: '1-Tap Collect',
    ta: '1-தட்டல் வசூல்',
  },
  bulkCollect: {
    en: 'Bulk Collect',
    ta: 'மொத்த வசூல்',
  },
  printSlip: {
    en: 'Print Slip',
    ta: 'ரசீது அச்சிடுக',
  },
  shareWhatsApp: {
    en: 'Share WhatsApp',
    ta: 'வாட்ஸ்அப் பகிர்',
  },
  searchPlaceholder: {
    en: 'Search Customer, Shop, Mobile, Account, Receipt #...',
    ta: 'வாடிக்கையாளர், கடை, மொபைல், கணக்கு, ரசீது எண் தேடுக...',
  },
  filter: {
    en: 'Filter',
    ta: 'வடிகட்டு',
  },
  allAreas: {
    en: 'All Areas',
    ta: 'அனைத்து பகுதிகள்',
  },
  allCollectors: {
    en: 'All Collectors',
    ta: 'அனைத்து வசூலிப்பாளர்கள்',
  },
  allStatuses: {
    en: 'All Statuses',
    ta: 'அனைத்து நிலைகள்',
  },
  routeOrder: {
    en: 'Route Order',
    ta: 'பயண வரிசை',
  },
  repaymentHistory: {
    en: 'Repayment History',
    ta: 'தவணை செலுத்திய வரலாறு',
  },
  saveChanges: {
    en: 'Save Changes',
    ta: 'மாற்றங்களைச் சேமி',
  },
  cancel: {
    en: 'Cancel',
    ta: 'ரத்து செய்',
  },
  submit: {
    en: 'Submit',
    ta: 'சமர்ப்பிக்கவும்',
  },
  close: {
    en: 'Close',
    ta: 'மூடுக',
  },
  downloadPdf: {
    en: 'Download Receipt PDF',
    ta: 'ரசீது PDF பதிவிறக்குக',
  },

  // Collections & Financial Terms
  dailyDue: {
    en: 'Daily Due',
    ta: 'தினசரி தவணை',
  },
  paidToday: {
    en: 'Paid Today',
    ta: 'இன்று செலுத்தியது',
  },
  remainingBalance: {
    en: 'Remaining Balance',
    ta: 'மீதமுள்ள இருப்பு',
  },
  totalLoan: {
    en: 'Total Loan Amount',
    ta: 'மொத்த கடன் தொகை',
  },
  totalCollected: {
    en: 'Total Collected',
    ta: 'மொத்தம் வசூலிக்கப்பட்டது',
  },
  totalExpected: {
    en: 'Total Expected',
    ta: 'எதிர்பார்க்கப்படும் தொகை',
  },
  totalPending: {
    en: 'Total Pending',
    ta: 'மொத்த நிலுவை',
  },
  missedDays: {
    en: 'Missed Days',
    ta: 'தவறிய நாட்கள்',
  },
  overdue: {
    en: 'Overdue',
    ta: 'காலதாமதம்',
  },
  collectionRate: {
    en: 'Collection Rate',
    ta: 'வசூல் விகிதம்',
  },
  loanClosed: {
    en: 'LOAN CLOSED',
    ta: 'கடன் முடிந்தது',
  },
  nilDue: {
    en: 'Nil Due',
    ta: 'நிலுவை இல்லை',
  },
  nilDueCert: {
    en: 'Nil Due Certificate',
    ta: 'நிலுவை இல்லை சான்றிதழ்',
  },
  repaymentProgress: {
    en: 'Repayment Progress',
    ta: 'தவணை செலுத்திய முன்னேற்றம்',
  },
  daysRemaining: {
    en: 'Days Remaining',
    ta: 'மீதமுள்ள நாட்கள்',
  },
  completedDays: {
    en: 'Completed Days',
    ta: 'முடிந்த நாட்கள்',
  },
  tenureDays: {
    en: 'Tenure (Days)',
    ta: 'கால அளவு (நாட்கள்)',
  },
  days: {
    en: 'days',
    ta: 'நாட்கள்',
  },

  // Payment Modes
  cash: {
    en: 'Cash (Agent Collected)',
    ta: 'ரொக்கம் (முகவர் வசூலித்தது)',
  },
  upi: {
    en: 'UPI (GPay / PhonePe / Paytm)',
    ta: 'UPI (கூகிள் பே / போன்பே / பேடிஎம்)',
  },
  bankTransfer: {
    en: 'Bank Transfer (NEFT / IMPS)',
    ta: 'வங்கி பரிமாற்றம் (NEFT / IMPS)',
  },
  payOnlineRazorpay: {
    en: 'Pay Online via UPI / Razorpay',
    ta: 'Razorpay UPI மூலம் உடனே செலுத்தவும்',
  },
  payCashDoorstep: {
    en: 'Cash Collected at Doorstep by Agent',
    ta: 'முகவரிடம் நேரடியாக ரொக்கமாக செலுத்தவும்',
  },
  paymentMode: {
    en: 'Payment Mode',
    ta: 'செலுத்தும் முறை',
  },

  // Statuses
  statusPaid: {
    en: 'PAID',
    ta: 'செலுத்தப்பட்டது',
  },
  statusPending: {
    en: 'PENDING',
    ta: 'நிலுவையில்',
  },
  statusPartial: {
    en: 'PARTIAL',
    ta: 'பகுதி செலுத்தியது',
  },
  statusMissed: {
    en: 'MISSED',
    ta: 'தவறியது',
  },
  statusAdvance: {
    en: 'ADVANCE',
    ta: 'முன்பணம்',
  },
  statusClosed: {
    en: 'CLOSED',
    ta: 'முடிந்தது',
  },

  // Auth & Login
  signIn: {
    en: 'Sign In',
    ta: 'உள்நுழைக',
  },
  usernameOrEmail: {
    en: 'Admin Username / Email',
    ta: 'நிர்வாகி பயனர் பெயர் / மின்னஞ்சல்',
  },
  agentIdPlaceholder: {
    en: 'Agent ID / Mobile (e.g. COL101)',
    ta: 'முகவர் எண் / கைபேசி (எ.கா. COL101)',
  },
  customerIdPlaceholder: {
    en: 'Customer ID / Mobile Number',
    ta: 'வாடிக்கையாளர் எண் / கைபேசி எண்',
  },
  password: {
    en: 'Password',
    ta: 'கடவுச்சொல்',
  },
  pinCode: {
    en: '4-digit PIN (e.g. 1234)',
    ta: '4-இலக்க பின் எண் (எ.கா. 1234)',
  },
  rememberMe: {
    en: 'Remember this session',
    ta: 'இந்த அமர்வை நினைவில் கொள்க',
  },
  instantLogin: {
    en: 'Instant 1-Click Login (3 Personas)',
    ta: 'உடனடி 1-தட்டல் உள்நுழைவு (3 பயனர்கள்)',
  },
  needHelp: {
    en: 'Need Help?',
    ta: 'உதவி தேவையா?',
  },

  // Theme & Language
  theme: {
    en: 'Theme',
    ta: 'தோற்றம்',
  },
  darkTheme: {
    en: 'Dark Theme',
    ta: 'இருண்ட பயன்முறை',
  },
  lightTheme: {
    en: 'Light Theme',
    ta: 'வெளிச்ச பயன்முறை',
  },
  language: {
    en: 'Language',
    ta: 'மொழி',
  },
  english: {
    en: 'English',
    ta: 'English (ஆங்கிலம்)',
  },
  tamil: {
    en: 'தமிழ் (Tamil)',
    ta: 'தமிழ்',
  },
  switchTheme: {
    en: 'Switch Theme',
    ta: 'தோற்றத்தை மாற்று',
  },
  switchLanguage: {
    en: 'Switch to Tamil',
    ta: 'ஆங்கிலத்திற்கு மாற்று',
  },
  tamilShort: {
    en: 'தமிழ்',
    ta: 'EN',
  },

  // Table Headers
  customerId: {
    en: 'Customer ID',
    ta: 'வாடிக்கையாளர் எண்',
  },
  customerAndMobile: {
    en: 'Customer & Mobile',
    ta: 'வாடிக்கையாளர் & கைபேசி',
  },
  shopAndArea: {
    en: 'Shop / Area',
    ta: 'கடை / பகுதி',
  },
  statusHeader: {
    en: 'Status',
    ta: 'நிலை',
  },
  fastActions: {
    en: 'Fast Actions',
    ta: 'விரைவு செயல்கள்',
  },
  viewAllNotifications: {
    en: 'View All Notifications',
    ta: 'அனைத்து அறிவிப்புகளையும் பார்க்க',
  },
  noNotifications: {
    en: 'No notifications yet',
    ta: 'அறிவிப்புகள் எதுவும் இல்லை',
  },
  date: {
    en: 'Date',
    ta: 'தேதி',
  },
  receiptNumber: {
    en: 'Receipt #',
    ta: 'ரசீது எண்',
  },
  amountPaid: {
    en: 'Amount Paid',
    ta: 'செலுத்திய தொகை',
  },
  mode: {
    en: 'Mode',
    ta: 'முறை',
  },
  receipt: {
    en: 'Receipt',
    ta: 'ரசீது',
  },
  doorstepHistory: {
    en: 'Doorstep Repayment History',
    ta: 'தவணை செலுத்திய வரலாறு',
  },
  allRecordedPayments: {
    en: 'All recorded payments with digital receipts',
    ta: 'டிஜிட்டல் ரசீதுகளுடன் பதிவு செய்யப்பட்ட அனைத்து கட்டணங்கள்',
  },
  transactions: {
    en: 'Transactions',
    ta: 'பரிவர்த்தனைகள்',
  },
  noPaymentsRecorded: {
    en: 'No payments recorded yet.',
    ta: 'இதுவரை எந்தக் கட்டணமும் பதிவு செய்யப்படவில்லை.',
  },
  inPersonCashOnly: {
    en: 'In-Person Cash Collection Only',
    ta: 'நேரடி ரொக்க வசூல் மட்டுமே',
  },
  cashCollectedByAgent: {
    en: 'Cash Collected by Authorized Agent',
    ta: 'அங்கீகரிக்கப்பட்ட முகவரால் ரொக்கம் வசூலிக்கப்படுகிறது',
  },
  cashPolicyDesc: {
    en: 'Cash is strictly collected in person by your authorized field collection officer at your doorstep or shop. Customers cannot submit cash online.',
    ta: 'ரொக்கம் உங்கள் வீட்டு வாசலிலோ அல்லது கடையிலோ உள்ள அங்கீகரிக்கப்பட்ட கள வசூல் அதிகாரியால் மட்டுமே நேரடியாக வசூலிக்கப்படுகிறது.',
  },
  assignedCollector: {
    en: 'Assigned Collector',
    ta: 'நியமிக்கப்பட்ட வசூலிப்பாளர்',
  },
  collectorHelpline: {
    en: 'Collector Helpline',
    ta: 'வசூலிப்பாளர் உதவி எண்',
  },
  collectionArea: {
    en: 'Collection Area',
    ta: 'வசூல் பகுதி',
  },
  safetyAdvisory: {
    en: 'Safety Advisory: Never hand cash to any unauthorized person. Always verify the collector and ensure an instant digital receipt is generated on the spot.',
    ta: 'பாதுகாப்பு ஆலோசனை: அங்கீகரிக்கப்படாத எவரிடமும் ரொக்கத்தை வழங்க வேண்டாம். எப்போதும் முகவரைச் சரிபார்த்து உடனடி ரசீதைப் பெறுங்கள்.',
  },
  congratsLoanClosed: {
    en: '🎉 Congratulations! Your Loan is Fully Closed!',
    ta: '🎉 வாழ்த்துகள்! உங்கள் கடன் கணக்கு முழுமையாக முடிந்தது!',
  },
  loanClosedDesc: {
    en: 'You have successfully completed 100% of your repayments for this collection cycle. Remaining balance is ₹0. Your account is categorized under Loan Closed.',
    ta: 'இந்த வசூல் சுழற்சிக்கான உங்கள் தவணைகளை 100% வெற்றிகரமாக முடித்துவிட்டீர்கள். மீதமுள்ள இருப்பு ₹0. உங்கள் கணக்கு முடிந்தது எனப் பதிவு செய்யப்பட்டுள்ளது.',
  },
  systemPreferences: {
    en: 'System Preferences',
    ta: 'கணினி விருப்பத்தேர்வுகள்',
  },
  displayAndLanguage: {
    en: 'Display & Language',
    ta: 'காட்சி & மொழி',
  },
  themeDesc: {
    en: 'Switch between Dark (Midnight Gold) and Light (Executive Slate) themes',
    ta: 'இருண்ட (Dark) மற்றும் வெளிச்ச (Light) பயன்முறைகளுக்கு இடையே மாற்றவும்',
  },
  totalCustomers: {
    en: 'Total Customers',
    ta: 'மொத்த வாடிக்கையாளர்கள்',
  },
  activeAccounts: {
    en: 'Active Accounts',
    ta: 'செயலில் உள்ள கணக்குகள்',
  },
  todayExpected: {
    en: "Today's Expected",
    ta: 'இன்றைய எதிர்பார்ப்பு',
  },
  todayCollected: {
    en: "Today's Collected",
    ta: 'இன்று வசூலானது',
  },
  todayPending: {
    en: "Today's Pending",
    ta: 'இன்றைய நிலுவை',
  },
  monthlyCollection: {
    en: 'Monthly Collection',
    ta: 'மாதாந்திர வசூல்',
  },
  totalOutstanding: {
    en: 'Total Outstanding',
    ta: 'மொத்த நிலுவைத் தொகை',
  },
  financeMargin: {
    en: 'Finance Margin',
    ta: 'நிதி விளிம்பு',
  },
  overdueAccounts: {
    en: 'Overdue Accounts',
    ta: 'தாமதமான கணக்குகள்',
  },
  managementHub: {
    en: 'MANAGEMENT HUB',
    ta: 'மேலாண்மை மையம்',
  },
  dailyTrend: {
    en: 'Daily Collection Performance Trend',
    ta: 'தினசரி வசூல் செயல்திறன் போக்கு',
  },
  paymentStatusDistribution: {
    en: "Today's Payment Status",
    ta: 'இன்றைய கட்டண நிலை',
  },
  monthlyDisbursement: {
    en: 'Monthly Disbursement vs Collection',
    ta: 'மாதாந்திர வழங்கல் vs வசூல்',
  },
  portfolioSummary: {
    en: 'Portfolio Finance Summary',
    ta: 'போர்ட்ஃபோலியோ நிதி சுருக்கம்',
  },

  // Customer Management View
  customerRegistry: {
    en: 'Customer Registry',
    ta: 'வாடிக்கையாளர் பதிவேடு',
  },
  customerManagement: {
    en: 'CUSTOMER MANAGEMENT',
    ta: 'வாடிக்கையாளர் மேலாண்மை',
  },
  manageKycProfiles: {
    en: 'Manage KYC profiles, shop details, active collection accounts, and access 360-degree customer dossiers.',
    ta: 'KYC சுயவிவரங்கள், கடை விவரங்கள், செயலில் உள்ள கடன் கணக்குகளை நிர்வகிக்கவும்.',
  },
  addNewCustomer: {
    en: 'Add New Customer',
    ta: 'புதிய வாடிக்கையாளர் சேர்க்க',
  },
  excelExport: {
    en: 'Excel Export',
    ta: 'எக்செல் ஏற்றுமதி',
  },
  allCustomers: {
    en: 'All Customers',
    ta: 'அனைத்து வாடிக்கையாளர்கள்',
  },
  activeLoans: {
    en: 'Active Loans',
    ta: 'செயலில் உள்ள கடன்கள்',
  },
  searchCustomerPlaceholder: {
    en: 'Search by name, ID, shop, or mobile...',
    ta: 'பெயர், எண், கடை அல்லது கைபேசி மூலம் தேடுக...',
  },
  customerAndBusiness: {
    en: 'Customer & Business',
    ta: 'வாடிக்கையாளர் & வணிகம்',
  },
  contactAndArea: {
    en: 'Contact & Area',
    ta: 'தொடர்பு & பகுதி',
  },
  activeCollectionLoan: {
    en: 'Active Collection Loan',
    ta: 'செயலில் உள்ள கடன்',
  },
  collectionProgress: {
    en: 'Collection Progress',
    ta: 'வசூல் முன்னேற்றம்',
  },
  actions: {
    en: 'Actions',
    ta: 'செயல்கள்',
  },
  viewDossier: {
    en: 'View 360 Dossier',
    ta: 'முழு சுயவிவரம் பார்க்க',
  },
  editProfile: {
    en: 'Edit Customer Profile',
    ta: 'சுயவிவரத்தைத் திருத்து',
  },
  deleteCustomer: {
    en: 'Delete Customer',
    ta: 'வாடிக்கையாளரை நீக்கு',
  },
  personalInfoTab: {
    en: 'Personal Info',
    ta: 'தனிப்பட்ட விவரங்கள்',
  },
  addressInfoTab: {
    en: 'Address Info',
    ta: 'முகவரி விவரங்கள்',
  },
  shopInfoTab: {
    en: 'Shop & Business',
    ta: 'கடை & வணிகம்',
  },
  fullName: {
    en: 'Full Name',
    ta: 'முழு பெயர்',
  },
  gender: {
    en: 'Gender',
    ta: 'பாலினம்',
  },
  male: {
    en: 'Male',
    ta: 'ஆண்',
  },
  female: {
    en: 'Female',
    ta: 'பெண்',
  },
  dob: {
    en: 'Date of Birth',
    ta: 'பிறந்த தேதி',
  },
  fatherOrHusbandName: {
    en: "Father's / Husband's Name",
    ta: 'தந்தை / கணவர் பெயர்',
  },
  motherName: {
    en: "Mother's Name",
    ta: 'தாய் பெயர்',
  },
  maritalStatus: {
    en: 'Marital Status',
    ta: 'திருமண நிலை',
  },
  married: {
    en: 'Married',
    ta: 'திருமணமானவர்',
  },
  single: {
    en: 'Single',
    ta: 'திருமணமாகாதவர்',
  },
  mobileNumber: {
    en: 'Mobile Number',
    ta: 'கைபேசி எண்',
  },
  alternatePhone: {
    en: 'Alternate Phone',
    ta: 'மாற்று தொலைபேசி',
  },
  whatsappNumber: {
    en: 'WhatsApp Number',
    ta: 'வாட்ஸ்அப் எண்',
  },
  emailAddress: {
    en: 'Email Address',
    ta: 'மின்னஞ்சல் முகவரி',
  },
  doorNumber: {
    en: 'Door / Flat No',
    ta: 'கதவு / வீட்டு எண்',
  },
  street: {
    en: 'Street / Road',
    ta: 'தெரு / சாலை',
  },
  area: {
    en: 'Area',
    ta: 'பகுதி',
  },
  city: {
    en: 'City',
    ta: 'நகரம்',
  },
  district: {
    en: 'District',
    ta: 'மாவட்டம்',
  },
  state: {
    en: 'State',
    ta: 'மாநிலம்',
  },
  pincode: {
    en: 'PIN Code',
    ta: 'அஞ்சல் குறியீடு',
  },
  landmark: {
    en: 'Landmark',
    ta: 'அடையாளம்',
  },
  shopName: {
    en: 'Shop / Business Name',
    ta: 'கடை / வணிகப் பெயர்',
  },
  businessType: {
    en: 'Business Type',
    ta: 'வணிக வகை',
  },
  businessCategory: {
    en: 'Business Category',
    ta: 'வணிகப் பிரிவு',
  },
  yearsInBusiness: {
    en: 'Years in Business',
    ta: 'வணிக ஆண்டுகள்',
  },
  dailySales: {
    en: 'Approx Daily Sales (₹)',
    ta: 'தோராய தினசரி விற்பனை (₹)',
  },
  monthlyIncome: {
    en: 'Approx Monthly Income (₹)',
    ta: 'தோராய மாதாந்திர வருமானம் (₹)',
  },
  createCustomerButton: {
    en: 'Create Customer Profile',
    ta: 'வாடிக்கையாளர் சுயவிவரம் உருவாக்கு',
  },

  // Collection Accounts View
  collectionAccountsTitle: {
    en: 'COLLECTION ACCOUNTS',
    ta: 'கடன் கணக்குகள்',
  },
  createNewAccount: {
    en: 'Create New Account',
    ta: 'புதிய கடன் கணக்கு தொடங்கு',
  },
  accountNumber: {
    en: 'Account #',
    ta: 'கணக்கு எண்',
  },
  customer: {
    en: 'Customer',
    ta: 'வாடிக்கையாளர்',
  },
  principalLoan: {
    en: 'Principal Loan Amount',
    ta: 'அசல் கடன் தொகை',
  },
  interestAmount: {
    en: 'Finance Margin / Interest',
    ta: 'வட்டி / நிதி விளிம்பு',
  },
  dailyInstallment: {
    en: 'Daily Installment Amount',
    ta: 'தினசரி தவணைத் தொகை',
  },
  collectionDays: {
    en: 'Collection Days',
    ta: 'தவணை நாட்கள்',
  },
  disbursementDate: {
    en: 'Disbursement Date',
    ta: 'கடன் வழங்கிய தேதி',
  },
  maturityDate: {
    en: 'Maturity Date',
    ta: 'முதிர்வுத் தேதி',
  },
  accountDetails: {
    en: 'Account Details',
    ta: 'கணக்கு விவரங்கள்',
  },

  // Customer 360 Profile
  customer360Title: {
    en: 'Customer 360 Dossier',
    ta: 'வாடிக்கையாளர் 360 முழு விவரம்',
  },
  backToCustomers: {
    en: 'Back to Customers',
    ta: 'வாடிக்கையாளர்கள் பட்டியலுக்குத் திரும்பு',
  },
  collectToday: {
    en: 'Collect Today',
    ta: 'இன்றைய தவணை வசூல்',
  },
  kycDocuments: {
    en: 'KYC Documents',
    ta: 'KYC ஆவணங்கள்',
  },
  loanHistory: {
    en: 'Loan History',
    ta: 'கடன் வரலாறு',
  },
  paymentReceipts: {
    en: 'Payment Receipts',
    ta: 'கட்டண ரசீதுகள்',
  },
  guarantorDetails: {
    en: 'Guarantor Details',
    ta: 'ஜாமீன்தாரர் விவரங்கள்',
  },

  // Collection Plans View
  collectionPlansTitle: {
    en: 'COLLECTION PLANS',
    ta: 'கடன் திட்டங்கள்',
  },
  createNewPlan: {
    en: 'Create Collection Plan',
    ta: 'புதிய கடன் திட்டம் உருவாக்கு',
  },
  planName: {
    en: 'Plan Name',
    ta: 'திட்டத்தின் பெயர்',
  },

  // Collectors & Areas View
  collectorsTitle: {
    en: 'COLLECTION OFFICERS',
    ta: 'கள வசூல் அதிகாரிகள்',
  },
  addCollector: {
    en: 'Add Collection Officer',
    ta: 'புதிய வசூல் அதிகாரியைச் சேர்க்க',
  },
  collectorName: {
    en: 'Collector Name',
    ta: 'வசூலிப்பாளர் பெயர்',
  },
  assignedArea: {
    en: 'Assigned Area',
    ta: 'ஒதுக்கப்பட்ட பகுதி',
  },
  areasTitle: {
    en: 'COLLECTION AREAS',
    ta: 'வசூல் பகுதிகள்',
  },
  addArea: {
    en: 'Add Collection Area',
    ta: 'புதிய வசூல் பகுதியைச் சேர்க்க',
  },
  areaName: {
    en: 'Area Name',
    ta: 'பகுதியின் பெயர்',
  },

  // Reports & Notifications
  reportsTitle: {
    en: 'FINANCIAL & AUDIT REPORTS',
    ta: 'நிதி & தணிக்கை அறிக்கைகள்',
  },
  notificationsTitle: {
    en: 'SYSTEM NOTIFICATIONS & AUDIT',
    ta: 'கணினி அறிவிப்புகள் & தணிக்கை',
  },
  markAllAsRead: {
    en: 'Mark All as Read',
    ta: 'அனைத்தையும் படித்ததாகக் குறிக்க',
  },

  // Receipts Master & Modals
  officialReceipt: {
    en: 'Official Receipt',
    ta: 'அதிகாரப்பூர்வ ரசீது',
  },
  whatsappShare: {
    en: 'WhatsApp Share',
    ta: 'வாட்ஸ்அப் பகிர்வு',
  },
  thermalSlip: {
    en: 'Thermal Slip',
    ta: 'தெர்மல் ரசீது',
  },
  printReceipt: {
    en: 'Print Receipt',
    ta: 'ரசீது அச்சிடுக',
  },
  closingIn: {
    en: 'Closing in',
    ta: 'மூட இன்னும்',
  },
  pauseAutoClose: {
    en: 'Pause',
    ta: 'இடைநிறுத்து',
  },
  autoClosePaused: {
    en: 'Auto-close paused',
    ta: 'தானியங்கி மூடல் இடைநிறுத்தப்பட்டது',
  },

  // Online Razorpay Modal
  onlinePaymentRazorpay: {
    en: 'Online Payment (Razorpay)',
    ta: 'ஆன்லைன் கட்டணம் (Razorpay)',
  },
  payNow: {
    en: 'Pay Now',
    ta: 'உடனே செலுத்தவும்',
  },
};

// Global direct fallback lookup table (case-insensitive) for any English text in the entire app
const englishToTamilMap: Record<string, string> = {
  // Navigation
  'dashboard': 'முகப்பு பலகை',
  'customers': 'வாடிக்கையாளர்கள்',
  'collection accounts': 'கடன் கணக்குகள்',
  'daily collections': 'தினசரி வசூல்',
  'daily register': 'தினசரி பதிவேடு',
  'monthly excel register': 'மாதாந்திர பதிவேடு',
  'monthly matrix register': 'மாதாந்திர வசூல் மேட்ரிக்ஸ்',
  'receipts': 'ரசீதுகள்',
  'receipts master': 'ரசீதுகள் மேலாண்மை',
  'collectors': 'வசூலிப்பாளர்கள்',
  'areas': 'பகுதிகள்',
  'documents': 'ஆவணங்கள்',
  'collection plans': 'கடன் திட்டங்கள்',
  'plans': 'கடன் திட்டங்கள்',
  'reports': 'அறிக்கைகள்',
  'collection reports': 'வசூல் அறிக்கைகள்',
  'notifications': 'அறிவிப்புகள்',
  'settings': 'அமைப்புகள்',
  'system settings': 'கணினி அமைப்புகள்',
  'logout': 'வெளியேறு',

  // Actions & Buttons
  'add': 'சேர்க்க',
  'add new': 'புதிதாக சேர்க்க',
  'add new customer': 'புதிய வாடிக்கையாளர் சேர்க்க',
  'add new account': 'புதிய கடன் கணக்கு தொடங்க',
  'add customer': 'வாடிக்கையாளர் சேர்க்க',
  'add plan': 'திட்டம் சேர்க்க',
  'add collector': 'வசூலிப்பாளர் சேர்க்க',
  'add area': 'பகுதி சேர்க்க',
  'edit': 'திருத்து',
  'delete': 'நீக்கு',
  'save': 'சேமி',
  'save changes': 'மாற்றங்களைச் சேமி',
  'save configuration': 'அமைப்புகளைச் சேமி',
  'save record changes': 'பதிவு மாற்றங்களைச் சேமி',
  'saving...': 'சேமிக்கிறது...',
  'cancel': 'ரத்து செய்',
  'close': 'மூடுக',
  'confirm': 'உறுதி செய்',
  'submit': 'சமர்ப்பிக்கவும்',
  'search': 'தேடுக',
  'filter': 'வடிகட்டு',
  'print': 'அச்சிடுக',
  'download': 'பதிவிறக்குக',
  'download pdf': 'ரசீது PDF பதிவிறக்குக',
  'export': 'ஏற்றுமதி',
  'excel export': 'எக்செல் ஏற்றுமதி',
  'export to excel': 'எக்செல் ஏற்றுமதி',
  'export to excel (.xls)': 'எக்செல் ஏற்றுமதி (.XLS)',
  'export current report to excel': 'தற்போதைய அறிக்கையை எக்செல் ஏற்றுமதி செய்க',
  'sync': 'ஒத்திசை',
  'refresh': 'புதுப்பி',
  'collect payment': 'பணம் வசூலிக்கவும்',
  'quick collect': '1-தட்டல் வசூல்',
  'bulk collect': 'மொத்த வசூல்',
  'view profile': 'சுயவிவரம் பார்க்க',
  'view 360 dossier': 'முழு விவரம் பார்க்க',
  'pay now': 'உடனே செலுத்தவும்',
  'mark all read': 'அனைத்தையும் படித்ததாகக் குறிக்கவும்',
  'try again': 'மீண்டும் முயற்சிக்கவும்',
  'back to daily collections': 'தினசரி வசூலுக்குத் திரும்பு',
  'back to customers list': 'வாடிக்கையாளர் பட்டியலுக்குத் திரும்பு',
  'collect today\'s payment': 'இன்றைய தவணையை வசூலிக்கவும்',
  'print register (a4 / ledger)': 'பதிவேட்டை அச்சிடு (A4 / லெட்ஜர்)',
  'send on whatsapp': 'வாட்ஸ்அப்பில் அனுப்பு',
  'whatsapp share': 'வாட்ஸ்அப் பகிர்வு',
  'official receipt': 'அதிகாரப்பூர்வ ரசீது',
  'thermal slip': 'தெர்மல் ரசீது',
  'confirm & collect all': 'உறுதி செய்து அனைத்தையும் வசூலி',

  // Statuses & Financials
  'active': 'செயலில் உள்ளது',
  'closed': 'முடிந்தது',
  'loan closed': 'கடன் முடிந்தது',
  'completed': 'முடிந்தது',
  'pending': 'நிலுவையில்',
  'paid': 'செலுத்தப்பட்டது',
  'partial': 'பகுதி செலுத்தியது',
  'missed': 'தவறியது',
  'advance': 'முன்பணம்',
  'overdue': 'காலதாமதம்',
  'verified': 'சரிபார்க்கப்பட்டது',
  'rejected': 'நிராகரிக்கப்பட்டது',
  'pending verification': 'சரிபார்ப்பு நிலுவை',
  'status': 'நிலை',
  'date': 'தேதி',
  'due': 'தவணை',
  'daily due': 'தினசரி தவணை',
  'amount': 'தொகை',
  'amount paid': 'செலுத்திய தொகை',
  'amount collected': 'வசூலான தொகை',
  'remaining': 'மீதம்',
  'remaining balance': 'மீதமுள்ள இருப்பு',
  'balance': 'இருப்பு',
  'total': 'மொத்தம்',
  'totals:': 'மொத்தம்:',
  'total expected': 'எதிர்பார்க்கப்படும் தொகை',
  'total collected': 'மொத்தம் வசூலானது',
  'total pending': 'மொத்த நிலுவை',
  'total customers': 'மொத்த வாடிக்கையாளர்கள்',
  'active accounts': 'செயலில் உள்ள கணக்குகள்',
  'collection rate': 'வசூல் விகிதம்',
  'today expected': 'இன்றைய எதிர்பார்ப்பு',
  'today collected': 'இன்று வசூலானது',
  'today pending': 'இன்றைய நிலுவை',
  'monthly collection': 'மாதாந்திர வசூல்',
  'total outstanding': 'மொத்த நிலுவைத் தொகை',
  'finance margin': 'நிதி விளிம்பு',
  'overdue accounts': 'தாமதமான கணக்குகள்',
  'management hub': 'மேலாண்மை மையம்',
  'total disbursed': 'மொத்தம் வழங்கியது',
  'total repayment': 'மொத்த திருப்பிச் செலுத்துதல்',
  '100-day goal': '100 நாள் இலக்கு',
  'actual collected': 'உண்மையில் வசூலானது',
  'monthly pending': 'மாதாந்திர நிலுவை',
  'accounts in matrix': 'அட்டவணையில் உள்ள கணக்குகள்',
  'calendar days': 'நாட்காட்டி நாட்கள்',
  'col rate': 'வசூல் விகிதம்',
  'req': 'கோரப்பட்டது',
  'disb': 'வழங்கியது',
  'daily': 'தினசரி',
  'margin': 'விளிம்பு',
  'monthly total': 'மாதாந்திர மொத்தம்',
  'expected': 'எதிர்பார்ப்பு',
  'col %': 'வசூல் %',
  'grand totals': 'மொத்த கூட்டுத்தொகை',
  'sl.': 'வரிசை',
  'cust id': 'வாடிக்கையாளர் எண்',
  'customer sign': 'வாடிக்கையாளர் கையப்பம்',
  'collector remarks': 'வசூலிப்பாளர் குறிப்புகள்',
  'pending to collect:': 'வசூலிக்க வேண்டிய மீதம்:',
  'total due expected:': 'மொத்த எதிர்பார்ப்பு தவணை:',
  'total actual collected:': 'உண்மையில் வசூலான மொத்தம்:',
  'total field pending:': 'கள நிலுவைத் தொகை:',
  'field collector signature': 'கள வசூலிப்பாளர் கையப்பம்',
  'branch manager signature': 'கிளை மேலாளர் கையப்பம்',
  'accountant audit sign': 'கணக்காளர் தணிக்கை கையப்பம்',
  'daily doorstep collection register': 'தினசரி கடைவீதி வசூல் பதிவேடு',
  'official field register ready for daily printing, physical collector audit, and shopkeeper signatures.': 'தினசரி அச்சிடவும், வசூலிப்பாளர் தணிக்கைக்கும், கடைக்காரர்களின் கையப்பத்திற்கும் ஏற்ற அதிகாரப்பூர்வ பதிவேடு.',
  'major audit & finance record': 'முக்கிய தணிக்கை & நிதி பதிவு',
  'monthly excel collection register': 'மாதாந்திர எக்செல் வசூல் பதிவேடு',
  'full 30-day matrix displaying exact doorstep collections per calendar day for each customer with automated monthly totals, margins, and excel export.': 'ஒவ்வொரு வாடிக்கையாளருக்கும் தினசரி வசூல், மாதாந்திர கூட்டுத்தொகை, விளிம்புகள் மற்றும் எக்செல் ஏற்றுமதியுடன் கூடிய முழு 30 நாள் மேட்ரிக்ஸ்.',
  'loading monthly matrix data...': 'மாதாந்திர தரவு ஏற்றப்படுகிறது...',
  'no collection accounts found for the selected period.': 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு கடன் கணக்குகள் எதுவும் கிடைக்கவில்லை.',

  // Forms & Details
  'customer id': 'வாடிக்கையாளர் எண்',
  'account id': 'கணக்கு எண்',
  'account #': 'கணக்கு எண்',
  'receipt #': 'ரசீது எண்',
  'receipt number': 'ரசீது எண்',
  'full name': 'முழு பெயர்',
  'customer name': 'வாடிக்கையாளர் பெயர்',
  'customer': 'வாடிக்கையாளர்',
  'mobile': 'கைபேசி',
  'mobile number': 'கைபேசி எண்',
  'phone': 'தொலைபேசி',
  'email': 'மின்னஞ்சல்',
  'address': 'முகவரி',
  'shop': 'கடை',
  'shop name': 'கடை பெயர்',
  'shop / business': 'கடை / வணிகம்',
  'business': 'வணிகம்',
  'business type': 'வணிக வகை',
  'business category': 'வணிகப் பிரிவு',
  'personal details': 'தனிப்பட்ட விவரங்கள்',
  'business details': 'வணிக விவரங்கள்',
  'address details': 'முகவரி விவரங்கள்',
  'loan history': 'கடன் வரலாறு',
  'payment history': 'கட்டண வரலாறு',
  'repayment history': 'தவணை செலுத்திய வரலாறு',
  'actions': 'செயல்கள்',
  'action': 'செயல்',
  'receipt': 'ரசீது',
  'mode': 'முறை',
  'payment mode': 'செலுத்தும் முறை',
  'cash': 'ரொக்கம்',
  'upi': 'UPI',
  'bank transfer': 'வங்கி பரிமாற்றம்',
  'razorpay upi': 'ரேசர்பே UPI',
  'razorpay netbanking': 'ரேசர்பே நெட்பேங்கிங்',
  'direct bank transfer': 'நேரடி வங்கி பரிமாற்றம்',
  'all areas': 'அனைத்து பகுதிகள்',
  'all collectors': 'அனைத்து வசூலிப்பாளர்கள்',
  'all statuses': 'அனைத்து நிலைகள்',
  'route order': 'பயண வரிசை',
  'route order sequence (#)': 'பயண வரிசை எண் (#)',
  'system preferences': 'கணினி விருப்பத்தேர்வுகள்',
  'display & language': 'காட்சி & மொழி',
  'theme': 'தோற்றம்',
  'dark theme': 'இருண்ட பயன்முறை',
  'light theme': 'வெளிச்ச பயன்முறை',
  'language': 'மொழி',
  'month': 'மாதம்',
  'year': 'ஆண்டு',
  'collector': 'வசூலிப்பாளர்',
  'area': 'பகுதி',
  'target': 'இலக்கு',
  'target amount': 'இலக்கு தொகை',
  'requested amount': 'கோரப்பட்ட தொகை',
  'disbursed amount': 'வழங்கப்பட்ட தொகை',
  'repayment goal': 'திருப்பிச் செலுத்தும் இலக்கு',
  'progress %': 'முன்னேற்றம் %',
  'description': 'விளக்கம்',
  'daily installment due': 'தினசரி தவணைத் தொகை',
  'previous balance': 'முந்தைய இருப்பு',
  'remaining loan balance': 'மீதமுள்ள கடன் இருப்பு',
  'authorized collector': 'அங்கீகரிக்கப்பட்ட வசூலிப்பாளர்',
  'collector signature': 'வசூலிப்பாளர் கையப்பம்',
  'thank you for your prompt payment.': 'உங்கள் உடனடி தவணைக் கட்டணத்திற்கு நன்றி.',
  'share receipt with customer': 'வாடிக்கையாளருக்கு ரசீதை பகிரவும்',
  'payment receipt': 'கட்டண ரசீது',
  'payment receipt & share': 'கட்டண ரசீது & பகிர்வு',
  'today': 'இன்று',
  'receipt delivered': 'ரசீது அனுப்பப்பட்டது',
  'send to:': 'அனுப்ப வேண்டிய எண்:',
  'closing in': 'மூடப்படுகிறது இன்னும்',
  'pause': 'நிறுத்து',
  'auto-close paused': 'தானியங்கி மூடல் நிறுத்தப்பட்டது',
  'digital receipts archive': 'டிஜிட்டல் ரசீதுகள் காப்பகம்',
  'audit, view, and re-print customer collection receipts.': 'வாடிக்கையாளர் வசூல் ரசீதுகளைத் தணிக்கை செய்ய, பார்க்க மற்றும் மறுஅச்சிட.',
  'search receipt #, customer, shop...': 'ரசீது எண், வாடிக்கையாளர், கடையைத் தேடுக...',
  'official payment documentation': 'அதிகாரப்பூர்வ கட்டண ஆவணங்கள்',

  // Reports Suite
  'reports & audit suite': 'அறிக்கைகள் & தணிக்கை மையம்',
  'financial intelligence': 'நிதி நுண்ணறிவு',
  'generate, filter, and export detailed analytical reports to excel.': 'விரிவான பகுப்பாய்வு அறிக்கைகளை உருவாக்கி, வடிகட்டி எக்செல் ஏற்றுமதி செய்யவும்.',
  'outstanding balance report': 'நிலுவைத் தொகை அறிக்கை',
  'overdue accounts report': 'காலதாமதமான கணக்குகள் அறிக்கை',
  'finance margin report': 'நிதி விளிம்பு அறிக்கை',
  'collector performance report': 'வசூலிப்பாளர் செயல்திறன் அறிக்கை',
  'payment ledger report': 'கட்டண லெட்ஜர் அறிக்கை',
  'assigned collector': 'நியமிக்கப்பட்ட வசூலிப்பாளர்',
  'route / area': 'பாதை / பகுதி',
  'outstanding balance': 'நிலுவை இருப்பு',
  'completed days': 'முடிந்த நாட்கள்',

  // Notifications
  'notifications & alerts': 'அறிவிப்புகள் & எச்சரிக்கைகள்',
  'communication center': 'தொடர்பு மையம்',
  'real-time alerts for payments, doorstep collections, and account updates.': 'கட்டணங்கள், வசூல்கள் மற்றும் கணக்கு புதுப்பிப்புகளுக்கான நேரலை அறிவிப்புகள்.',
  'no notifications recorded yet.': 'அறிவிப்புகள் எதுவும் இதுவரை பதிவு செய்யப்படவில்லை.',

  // Razorpay & Online Payments
  'razorpay checkout': 'ரேசர்பே கட்டணம்',
  'secured 256-bit ssl gateway': 'பாதுகாப்பான 256-பிட் SSL நுழைவாயில்',
  'verified merchant': 'சரிபார்க்கப்பட்ட வணிகர்',
  'razorpay secure processing': 'ரேசர்பே பாதுகாப்பான செயலாக்கம்',
  'payment approved!': 'கட்டணம் வெற்றிகரமாக அங்கீகரிக்கப்பட்டது!',
  'payment failed': 'கட்டணம் தோல்வியடைந்தது',
  'repayment for': 'கடன் கணக்குக்கான கட்டணம்',
  'current remaining balance': 'தற்போதைய நிலுவை இருப்பு',
  'select amount to repay': 'செலுத்த வேண்டிய தொகையைத் தேர்ந்தெடுக்கவும்',
  '1 day': '1 நாள்',
  '2 days': '2 நாட்கள்',
  '5 days': '5 நாட்கள்',
  '1 week': '1 வாரம்',
  'close loan': 'முழுக் கடன் முடிவு',
  'full balance': 'முழு இருப்பு',
  'scan upi qr': 'UPI QR குறியீட்டை ஸ்கேன் செய்க',
  'netbanking': 'இணைய வங்கி (NetBanking)',
  'direct transfer': 'நேரடி வங்கி கணக்கு',
  'select your preferred upi application. you will be redirected to approve': 'உங்கள் விருப்பமான UPI செயலியைத் தேர்ந்தெடுக்கவும். ஒப்புதலுக்காக நீங்கள் திருப்பிவிடப்படுவீர்கள்',
  'or enter upi id / vpa': 'அல்லது உங்கள் UPI முகவரியை (VPA) உள்ளிடவும்',
  'qr active:': 'QR செயலில் உள்ளது:',
  'instant auto-verify': 'உடனடி தானியங்கி சரிபார்ப்பு',
  'choose your bank for direct internet banking authorization.': 'நேரடி இணைய வங்கி அங்கீகாரத்திற்காக உங்கள் வங்கியைத் தேர்ந்தெடுக்கவும்.',
  'other banks (50+ indian banks)': 'பிற வங்கிகள் (50+ இந்திய வங்கிகள்)',
  'beneficiary name': 'பயனாளி பெயர்',
  'virtual a/c number': 'மெய்நிகர் வங்கி கணக்கு எண்',
  'ifsc code': 'IFSC குறியீடு',
  'account type & bank': 'கணக்கு வகை & வங்கி',
  'pci-dss compliant • 100% safe & secure': 'PCI-DSS தரநிலை • 100% பாதுகாப்பானது',

  // Modals & Field Collections
  'doorstep payment collection': 'கடைவீதி தவணை வசூல்',
  'bulk collection confirmation': 'மொத்த வசூல் உறுதிப்படுத்தல்',
  'process': 'செயல்படுத்து',
  'accounts simultaneously': 'கணக்குகள் ஒரே நேரத்தில்',
  'selected accounts:': 'தேர்ந்தெடுக்கப்பட்ட கணக்குகள்:',
  'collection type:': 'வசூல் வகை:',
  'today\'s daily due': 'இன்றைய தினசரி தவணை',
  'full remaining balance': 'முழு மீதமுள்ள இருப்பு',
  'total to collect:': 'வசூலிக்க வேண்டிய மொத்தம்:',
  'payment mode for bulk batch': 'மொத்த தொகுதிக்கு செலுத்தும் முறை',
  'collecting agent': 'வசூல் முகவர்',
  'mark as missed collection (customer unable to pay today)': 'தவறிய வசூலாகக் குறிக்கவும் (வாடிக்கையாளர் இன்று செலுத்த முடியவில்லை)',
  'reason for missed collection': 'வசூல் தவறியதற்கான காரணம்',
  'shop closed today': 'இன்று கடை மூடப்பட்டுள்ளது',
  'customer out of town': 'வாடிக்கையாளர் வெளியூர் சென்றுள்ளார்',
  'cash shortage - promised tomorrow': 'பணப் பற்றாக்குறை - நாளை தருவதாக உறுதியளித்தார்',
  'medical / family emergency': 'மருத்துவ / குடும்ப அவசரநிலை',
  'bank holiday / atm issue': 'வங்கி விடுமுறை / ATM பிரச்சனை',
  'refused to pay / dispute': 'செலுத்த மறுப்பு / தகராறு',
  'remarks / notes': 'குறிப்புகள் / விவரங்கள்',
  'remarks / reason': 'குறிப்புகள் / காரணம்',
  'payment status': 'கட்டண நிலை',
  'assigned field collector': 'நியமிக்கப்பட்ட கள வசூலிப்பாளர்',
  'admin edit daily collection record': 'நிர்வாகி தினசரி வசூல் பதிவைத் திருத்துதல்',
  'full payment ledger and digital receipt records for this customer:': 'இந்த வாடிக்கையாளரின் முழு கட்டண லெட்ஜர் மற்றும் ரசீது பதிவுகள்:',
  'customers selected for bulk processing': 'வாடிக்கையாளர்கள் மொத்த வசூலுக்குத் தேர்ந்தெடுக்கப்பட்டுள்ளனர்',
  'bulk collect today\'s dues': 'இன்றைய தவணைகளை மொத்தமாக வசூலி',
  'close all balances': 'அனைத்து நிலுவைகளையும் முடி',
  'disburse new loan': 'புதிய கடன் வழங்குக',
  'create custom plan': 'புதிய திட்டம் உருவாக்குக',
  'add new collector': 'புதிய வசூலிப்பாளர் சேர்க்க',
  'add new area': 'புதிய பகுதி சேர்க்க',
  'disbursed to customer': 'வாடிக்கையாளருக்கு வழங்கியது',
  'doorstep daily due': 'தினசரி தவணைத் தொகை',
  'collection period': 'வசூல் காலம் (நாட்கள்)',
  'repay - disbursed': 'திருப்பிச் செலுத்துதல் - வழங்கியது',
  'kyc & customer dossiers': 'KYC ஆவணங்கள் & சுயவிவரங்கள்',
  'all documents': 'அனைத்து ஆவணங்கள்',
  'preview': 'முன்னோட்டம்',
  'approve': 'அங்கீகரி',
  'reject': 'நிராகரி',
  'document type': 'ஆவண வகை',
  'aadhaar card': 'ஆதார் அட்டை',
  'pan card': 'பான் அட்டை',
  'voter id': 'வாக்காளர் அட்டை',
  'ration card': 'ரேஷன் அட்டை',
  'driving license': 'ஓட்டுநர் உரிமம்',
  'bank passbook': 'வங்கி பாஸ்புக்',
  'rental agreement': 'வாடகை ஒப்பந்தம்',
  'overview': 'மேலோட்டம்',
  'kyc documents': 'KYC ஆவணங்கள்',
  'notes': 'குறிப்புகள்',
  'audit history': 'தணிக்கை வரலாறு',
  'all customers': 'அனைத்து வாடிக்கையாளர்கள்',
  'active loans': 'செயலில் உள்ள கடன்கள்',
  'quick collect today\'s due': 'இன்றைய தவணையை உடனே வசூலி',
  'quick collect modal': 'விரைவு வசூல் சாளரம்',
  'bulk collect remaining balances': 'மீதமுள்ள இருப்பை மொத்தமாக வசூலி',
  'collection route order': 'வசூல் பயண வரிசை',
  'payment history per customer': 'வாடிக்கையாளர் வாரியாக கட்டண வரலாறு',
  'missed days': 'தவறிய நாட்கள்',
  'days': 'நாட்கள்',
  'cancel selection': 'தேர்வை ரத்துசெய்',
  'total daily due:': 'மொத்த தினசரி தவணை:',
  'total balance:': 'மொத்த கடன் இருப்பு:',
  'customer:': 'வாடிக்கையாளர்:',
  'shop:': 'கடை:',
  'account:': 'கணக்கு:',
  'daily installment due:': 'தினசரி தவணைத் தொகை:',
  'amount paid:': 'செலுத்திய தொகை:',
  'bal after:': 'மீதமுள்ள இருப்பு:',
  'mode:': 'பணம் செலுத்திய முறை:',
  'close history': 'வரலாற்றை மூடு',
  'account id:': 'கணக்கு எண்:',
  'shop / area:': 'கடை / பகுதி:',
  'remaining account bal:': 'மீதமுள்ள கடன் இருப்பு:',
  'loading history...': 'வரலாறு ஏற்றப்படுகிறது...',
  'no payment transactions recorded for this customer yet.': 'இந்த வாடிக்கையாளருக்கு இதுவரை பரிவர்த்தனைகள் எதுவும் பதிவு செய்யப்படவில்லை.',
  'cash (agent doorstep)': 'ரொக்கம் (முகவர் கடைவீதி வசூல்)',
  'field agent in-person': 'கள முகவர் நேரில் வசூலித்தல்',
  'online bank gateway': 'ஆன்லைன் வங்கி நுழைவாயில்',
  'neft / imps / rtgs': 'NEFT / IMPS / RTGS',
  'cash collection policy: cash is collected strictly in-person by the authorized agent at the customer\'s shop. instant digital receipt will be recorded.': 'ரொக்க வசூல் கொள்கை: வாடிக்கையாளரின் கடையில் அங்கீகரிக்கப்பட்ட முகவரால் மட்டுமே ரொக்கம் நேரில் பெறப்படும். உடனடி டிஜிட்டல் ரசீது பதிவு செய்யப்படும்.',
  'record missed collection': 'தவறிய வசூலைப் பதிவுசெய்',
  'confirm & record': 'உறுதிசெய்து பதிவுசெய்',
  'cash (agent collected)': 'ரொக்கம் (முகவர் பெற்றது)',
  'upi (gpay / phonepe / paytm)': 'UPI (GPay / PhonePe / Paytm)',
  'bank transfer (neft / imps)': 'வங்கி பரிமாற்றம் (NEFT / IMPS)',
  'razorpay upi gateway': 'ரேசர்பே UPI நுழைவாயில்',
  'other mode': 'பிற முறை',
  'paid amount (₹)': 'செலுத்திய தொகை (₹)',
  'daily due (₹)': 'தினசரி தவணை (₹)',
  'razorpay upi apps': 'ரேசர்பே UPI செயலிகள்',
  'scan with google pay, phonepe, paytm, or bhim app to pay': 'Google Pay, PhonePe, Paytm அல்லது BHIM செயலி மூலம் செலுத்த ஸ்கேன் செய்க',
  'copy account number': 'கணக்கு எண்ணை நகலெடு',
  'copy ifsc': 'IFSC ஐ நகலெடு',
  'transfers made to this unique account are automatically reconciled and credited to your daily collection balance within 15 minutes.': 'இந்த பிரத்யேக கணக்கிற்கு செய்யப்படும் பணப்பரிவர்த்தனைகள் தானாகவே சரிபார்க்கப்பட்டு 15 நிமிடங்களுக்குள் உங்கள் DAILY COLLECTION நிலுவையில் வரவு வைக்கப்படும்.',
  'razorpay smart collect virtual account (neft / imps)': 'ரேசர்பே ஸ்மார்ட் கலெக்ட் மெய்நிகர் கணக்கு (NEFT / IMPS)',

  // Customer Management Modals
  'register new customer': 'புதிய வாடிக்கையாளரை பதிவு செய்க',
  '1. personal details': '1. தனிநபர் விவரங்கள்',
  '2. residential address': '2. குடியிருப்பு முகவரி',
  '3. shop / business details': '3. கடை / வணிக விவரங்கள்',
  'full legal name': 'முழு சட்டபூர்வ பெயர்',
  'gender': 'பாலினம்',
  'male': 'ஆண்',
  'female': 'பெண்',
  'date of birth': 'பிறந்த தேதி',
  "father's / husband's name": 'தந்தை / கணவர் பெயர்',
  'father / husband name': 'தந்தை / கணவர் பெயர்',
  "mother's name": 'தாய் பெயர்',
  'mobile number (primary)': 'முதன்மை கைபேசி எண்',
  'alternate number': 'மாற்று எண்',
  'whatsapp number': 'வாட்ஸ்அப் எண்',
  'email address': 'மின்னஞ்சல் முகவரி',
  'door number': 'கதவு எண்',
  'door / flat number': 'கதவு / பிளாட் எண்',
  'street': 'தெரு',
  'street / cross name': 'தெரு / குறுக்குத் தெரு பெயர்',
  'area / locality': 'பகுதி / இருப்பிடம்',
  'city / town': 'நகரம் / ஊர்',
  'district': 'மாவட்டம்',
  'pincode': 'அஞ்சல் குறியீடு',
  'landmark': 'அடையாளக் குறி',
  'shop / business name': 'கடை / வணிகப் பெயர்',
  'shop contact number': 'கடை தொடர்பு எண்',
  'years in business': 'வணிகத்தில் உள்ள ஆண்டுகள்',
  'years in operation': 'இயக்கத்தில் உள்ள ஆண்டுகள்',
  'approx daily sales (₹)': 'தோராய தினசரி விற்பனை (₹)',
  'approx. daily sales (₹)': 'தோராய தினசரி விற்பனை (₹)',
  'approx monthly income (₹)': 'தோராய மாதாந்திர வருமானம் (₹)',
  'approx. monthly net income (₹)': 'தோராய மாதாந்திர நிகர வருமானம் (₹)',
  'previous': 'முந்தையது',
  'next': 'அடுத்தது',
  'registering...': 'பதிவு செய்யப்படுகிறது...',
  'complete customer registration': 'வாடிக்கையாளர் பதிவை முடிக்கவும்',
  'admin edit customer profile': 'நிர்வாகி வாடிக்கையாளர் சுயவிவரத்தைத் திருத்துதல்',
  'marital status': 'திருமண நிலை',
  'married': 'திருமணமானவர்',
  'single': 'திருமணமாகாதவர்',
  'divorced': 'விவாகரத்து பெற்றவர்',
  'widowed': 'விதவை / விதவைப்பெண்',
  'customer account status': 'வாடிக்கையாளர் கணக்கு நிலை',
  'deactivate customer': 'வாடிக்கையாளரை முடக்கு',
  'save profile changes': 'சுயவிவர மாற்றங்களைச் சேமிக்கவும்',
  'loading customers...': 'வாடிக்கையாளர்கள் ஏற்றப்படுகின்றனர்...',
  'no customers found for selected filter.': 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிக்கு வாடிக்கையாளர்கள் இல்லை.',
  'no active account': 'செயலில் உள்ள கணக்கு இல்லை',
  'loan': 'கடன்',
  'loan progress & status': 'கடன் முன்னேற்றம் & நிலை',
  'showing': 'காட்டப்படுகிறது',

  // Collection Accounts Modals & Fields
  'disburse new collection account': 'புதிய வசூல் கணக்கு வழங்குக',
  'select customer': 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்',
  'select collection plan': 'வசூல் திட்டத்தைத் தேர்ந்தெடுக்கவும்',
  'disbursed (given to cust)': 'வழங்கப்பட்டது (வாடிக்கையாளருக்கு)',
  'duration': 'கால அளவு',
  'start date': 'தொடக்க தேதி',
  'disbursing...': 'வழங்கப்படுகிறது...',
  'confirm loan & disburse': 'கடனை உறுதிசெய்து வழங்கவும்',
  'admin edit collection account': 'நிர்வாகி கடன் கணக்கைத் திருத்துதல்',
  'duration (collection days)': 'கால அளவு (வசூல் நாட்கள்)',
  'disbursed principal (₹)': 'வழங்கப்பட்ட அசல் (₹)',
  'total target repayment (₹)': 'மொத்த திருப்பிச் செலுத்தும் இலக்கு (₹)',
  'remaining outstanding (₹)': 'மீதமுள்ள நிலுவைத் தொகை (₹)',
  'setting to 0 moves customer to "loan closed"': '0 என மாற்றினால் வாடிக்கையாளர் "கடன் முடிந்தது" நிலைக்கு மாற்றப்படுவார்',
  'collection area / beat': 'வசூல் பகுதி / பாதை',
  'account loan status': 'கடன் கணக்கு நிலை',
  'active (ongoing doorstep dues)': 'செயலில் (தினசரி வசூல் நடைபெறுகிறது)',
  'overdue (missed consecutive days)': 'தாமதம் (தொடர்ச்சியாக தவறவிடப்பட்ட நாட்கள்)',
  'completed (loan closed • nil dues)': 'முடிந்தது (முழு கடன் முடிவு • பூஜ்ஜிய நிலுவை)',
  'suspended (temporarily held)': 'இடைநிறுத்தப்பட்டது (தற்காலிகமாக நிறுத்தி வைக்கப்பட்டுள்ளது)',
  'delete account': 'கணக்கை நீக்கு',
  'save account changes': 'கணக்கு மாற்றங்களைச் சேமிக்கவும்',
  'all accounts': 'அனைத்து கணக்குகள்',
  'overdue loans': 'தாமதமான கடன்கள்',
  'days left': 'நாட்கள் மீதம்',
  'records': 'பதிவுகள்',
  'collect': 'வசூலி',

  // Dashboard Overview
  'loading dashboard...': 'டாஷ்போர்டு ஏற்றப்படுகிறது...',
  'financial operations': 'நிதி செயல்பாடுகள்',
  '100-day daily cycle': '100-நாள் தினசரி சுழற்சி',
  'disbursing micro-growth capital to local shop owners with daily doorstep repayments, digital receipts, and real-time ledger accounting.': 'உள்ளூர் கடை உரிமையாளர்களுக்கு தினசரி தவணை திருப்பிச் செலுத்துதல், டிஜிட்டல் ரசீதுகள் மற்றும் நேரடி லெட்ஜர் கணக்குடன் கூடிய மூலதன நிதி வழங்கல்.',
  'active shops & vendors': 'செயலில் உள்ள கடைகள் & வணிகர்கள்',
  'under active 100-day cycles': 'செயலில் உள்ள 100-நாள் சுழற்சியில்',
  'scheduled due today': 'இன்று திட்டமிடப்பட்ட தவணை',
  'pending field visits': 'நிலுவையில் உள்ள களப் பார்வைகள்',
  'current calendar month': 'நடப்பு நாட்காட்டி மாதம்',
  'remaining balance in field': 'களத்தில் உள்ள மீதமுள்ள கடன் இருப்பு',
  'net interest/margin yield': 'நிகர வட்டி/விளிம்பு வருவாய்',
  'requires collector follow-up': 'வசூலிப்பாளர் தொடர் நடவடிக்கை தேவை',
  "today's progress": 'இன்றைய முன்னேற்றம்',
  'daily collection performance trend': 'தினசரி வசூல் செயல்திறன் போக்கு',
  'expected vs actual doorstep collections (past 14 days)': 'எதிர்பார்க்கப்பட்ட vs உண்மையான வசூல் (கடந்த 14 நாட்கள்)',
  'daily in inr (₹)': 'தினசரி ரூபாயில் (₹)',
  'expected due': 'எதிர்பார்க்கப்பட்ட தவணை',
  'actually collected': 'உண்மையில் வசூலானது',
  "today's payment status": 'இன்றைய கட்டண நிலை',
  'paid, partial, pending & overdue accounts': 'செலுத்திய, பகுதி, நிலுவை & தாமதமான கணக்குகள்',
  'monthly collection progress': 'மாதாந்திர வசூல் முன்னேற்றம்',
  'monthly collected vs target': 'மாதாந்திர வசூல் vs இலக்கு',
  'excel matrix': 'எக்செல் மேட்ரிக்ஸ்',
  'portfolio finance summary': 'முதலீட்டு நிதி சுருக்கம்',
  'total disbursed vs repayment vs margin vs outstanding': 'வழங்கியது vs திருப்பிச் செலுத்துதல் vs விளிம்பு vs நிலுவை',

  // Customer Self-Service Portal
  'loading your account...': 'உங்கள் கணக்கு ஏற்றப்படுகிறது...',
  'customer self-service portal': 'வாடிக்கையாளர் சுயசேவை தளம்',
  'welcome': 'வருக',
  'active repayment cycle': 'செயலில் உள்ள தவணை சுழற்சி',
  'expected completion': 'எதிர்பார்க்கப்படும் முடிவு',
  'doorstep collector': 'கடைவீதி வசூலிப்பாளர்',
  'pay online via razorpay': 'ரேசர்பே வழியாக ஆன்லைனில் செலுத்துக',
  'pay installment via razorpay': 'ரேசர்பே மூலம் தவணையைச் செலுத்துக',
  'kyc & business documents': 'KYC & வணிக ஆவணங்கள்',
  'official identification and shop verification records': 'அதிகாரப்பூர்வ அடையாள மற்றும் கடை சரிபார்ப்பு பதிவுகள்',
  'upload document': 'ஆவணத்தைப் பதிவேற்றவும்',
  'upload kyc document': 'KYC ஆவணத்தைப் பதிவேற்றவும்',
  'document number / id': 'ஆவண எண் / ஐடி',
  'uploading...': 'பதிவேற்றப்படுகிறது...',
  'submit document': 'ஆவணத்தை சமர்ப்பிக்கவும்',
  'shop / commercial details': 'கடை / வணிக விவரங்கள்',
  'approx daily sales': 'தோராய தினசரி விற்பனை',
  'owner personal profile': 'உரிமையாளர் தனிப்பட்ட சுயவிவரம்',
  'owner name': 'உரிமையாளர் பெயர்',
  'residential city': 'குடியிருப்பு நகரம்',
  'portal access pin': 'தள அணுகல் பின் எண்',
  'by': 'மூலம்',
  'doc number': 'ஆவண எண்',
  'uploaded on': 'பதிவேற்றப்பட்ட தேதி',

  // Settings
  'customize branch business parameters, receipt prefix, and system defaults.': 'கிளை வணிக அளவுருக்கள், ரசீது முன்னொட்டு மற்றும் இயல்புநிலை அமைப்புகளைத் தனிப்பயனாக்குங்கள்.',
  'reset sample demo data': 'மாதிரி டெமோ தரவை மீட்டமைக்கவும்',
  'company & branch identity': 'நிறுவனம் & கிளை அடையாளம்',
  'company brand name': 'நிறுவன முத்திரை பெயர்',
  'system tagline': 'கணினி வாசகம்',
  'registered office address': 'பதிவு செய்யப்பட்ட அலுவலக முகவரி',
  'official telephone / mobile': 'அதிகாரப்பூர்வ தொலைபேசி / கைபேசி',
  'official support email': 'அதிகாரப்பூர்வ ஆதரவு மின்னஞ்சல்',
  'receipt & collection parameters': 'ரசீது & வசூல் அளவுருக்கள்',
  'receipt number prefix': 'ரசீது எண் முன்னொட்டு',
  'currency symbol': 'நாணய குறியீடு',
  'default collection days': 'இயல்புநிலை வசூல் நாட்கள்',

  // Auth & Login
  'admin or admin@dailycollection.com': 'admin அல்லது admin@dailycollection.com',
  'e.g. col101 or 9842111223': 'உதா: COL101 அல்லது 9842111223',
  'e.g. 9876543210 or krs10001': 'உதா: 9876543210 அல்லது KRS10001',
  '4-digit pin (e.g. 1234)': '4 இலக்க பின் (உதா: 1234)',
  'pinplaceholder': '4 இலக்க பின் (உதா: 1234)',
  'demo credentials guide': 'டெமோ உள்நுழைவு வழிகாட்டி',
  'pre-configured test accounts ready for demonstration:': 'செயல்முறை விளக்கத்திற்கு முன் கட்டமைக்கப்பட்ட கணக்குகள்:',
  'admin account': 'நிர்வாகி கணக்கு',
  'customer account': 'வாடிக்கையாளர் கணக்கு',
  'user:': 'பயனர்:',
  'pass:': 'கடவுச்சொல்:',
  'cust id:': 'வாடிக்கையாளர் எண்:',
  'or dc10001': 'அல்லது DC10001',
  'pin:': 'பின் எண்:',
  'authentication failed. please verify your credentials.': 'அங்கீகரிப்பு தோல்வியடைந்தது. உங்கள் விவரங்களைச் சரிபார்க்கவும்.',

  // Daily Collection Screen
  'refresh collections': 'வசூல் பட்டியலைப் புதுப்பிக்கவும்',
  "1-tap collect today's due in cash": 'இன்றைய தவணையை 1-தட்டலில் பணமாக வசூலிக்கவும்',
  'quick': 'விரைவு',
  'collect custom amount, missed days, or record missed': 'தனிப்பயன் தொகை, விடுபட்ட நாட்கள் அல்லது தவறவிட்டதைப் பதிவுசெய்க',
  'view customer repayment history': 'வாடிக்கையாளர் திருப்பிச் செலுத்தும் வரலாற்றைக் காண்க',
  'admin edit daily record (due, status, mode, route)': 'நிர்வாகி திருத்துதல் (தவணை, நிலை, முறை, பாதை)',
  'print & whatsapp share receipt': 'ரசீதை அச்சிடுக & வாட்ஸ்அப்பில் பகிர்க',
  'select pending dues': 'நிலுவையில் உள்ள தவணைகளைத் தேர்ந்தெடு',
  'e.g. collected cash at cash counter / promised tomorrow morning': 'உதா: ரொக்கமாகப் பெறப்பட்டது / நாளை காலை தருவதாக உறுதி',
  'e.g. paid at shop, or reason for delay': 'உதா: கடையில் செலுத்தப்பட்டது, அல்லது தாமதத்திற்கான காரணம்',

  // Receipt Modal
  'pause auto-closing': 'தானியங்கு மூடுதலை இடைநிறுத்துக',
  'close receipt': 'ரசீதை மூடுக',
  'txn / ref': 'பரிவர்த்தனை குறிப்பு',
  'enter customer whatsapp number': 'வாடிக்கையாளர் வாட்ஸ்அப் எண்ணை உள்ளிடவும்',
  'mount road, chennai': 'மவுண்ட் ரோடு, சென்னை',
  'ph:': 'தொலைபேசி:',
  'rcpt:': 'ரசீது:',
  'cust:': 'வாடிக்கையாளர்:',
  'daily due:': 'தினசரி தவணை:',
  'paid amt:': 'செலுத்திய தொகை:',
  'ref:': 'குறிப்பு:',
  'prev bal:': 'முந்தைய இருப்பு:',
  'rem bal:': 'மீதமுள்ள கடன் இருப்பு:',
  'collector:': 'வசூலிப்பாளர்:',
  '*** thank you ***': '*** நன்றி ***',
  'keep receipt for disputes': 'எதிர்காலக் குறிப்புக்காக ரசீதை வைத்திருக்கவும்',
  'formatted for 58mm / 80mm bluetooth esc/pos mobile printers.': '58மிமீ / 80மிமீ புளூடூத் ESC/POS பிரிண்டர்களுக்கு வடிவமைக்கப்பட்டது.',

  // Customer Portal & Razorpay
  'online gateway': 'ஆன்லைன் கேட்வே',
  'instant self-repayment via google pay, phonepe, paytm, bhim, upi qr or netbanking. remaining loan balance decreases instantly.': 'கூகிள் பே, போன்பே, பேடிஎம், பிஎச்ஐஎம், யுபிஐ அல்லது நெட்பேங்கிங் மூலம் உடனடி சுயமாகச் செலுத்துதல். மீதமுள்ள கடன் உடனடியாகக் குறைகிறது.',
  'configured': 'அமைக்கப்பட்டுள்ளது',
  'e.g. 1234 5678 9012': 'உதா: 1234 5678 9012',
  'checkout': 'செக்அவுட்',
  'close payment window': 'பணம் செலுத்தும் சாளரத்தை மூடுக',
  'enter amount': 'தொகையை உள்ளிடவும்',
  'e.g. mobile@okaxis, shop@paytm': 'உதா: mobile@okaxis, shop@paytm',

  // Master views & Customer Management
  'admin edit account parameters': 'நிர்வாகி கடன் கணக்கு அளவுருக்களைத் திருத்துதல்',
  'view 360° profile': '360° முழு விவரக் குறிப்பைக் காண்க',
  'e.g. shevapet market': 'உதா: செவ்வாய்ப்பேட்டை மார்க்கெட்',
  'e.g. murugan s.': 'உதா: முருகன் எஸ்.',
  'admin edit customer': 'நிர்வாகி வாடிக்கையாளரைத் திருத்துதல்',
  'e.g. ramesh kumar': 'உதா: ரமேஷ் குமார்',
  'e.g. shanmugam k.': 'உதா: சண்முகம் கே.',
  'e.g. lakshmi s.': 'உதா: லட்சுமி எஸ்.',
  '10-digit mobile': '10 இலக்க மொபைல் எண்',
  'same as mobile': 'மொபைல் எண்ணே போதுமானது',
  'customer@gmail.com': 'customer@gmail.com',
  'e.g. 12/4': 'உதா: 12/4',
  'e.g. agraharam north street': 'உதா: அக்ரஹாரம் வடக்குத் தெரு',
  'e.g. near temple': 'உதா: கோவில் அருகில்',
  'e.g. sri krishna supermarket & provisions': 'உதா: ஸ்ரீ கிருஷ்ணா சூப்பர் மார்க்கெட்',
  'e.g. retail grocery, textiles, tea stall...': 'உதா: மளிகைக் கடை, ஜவுளி, டீக்கடை...',
  'refresh dashboard': 'முகப்பு பலகையைப் புதுப்பிக்கவும்',
  'delete document': 'ஆவணத்தை நீக்குக',
  '100-day dynamic formula': '100-நாள் மாறும் சூத்திரம்',
  'e.g. silver 100-day plan (₹20,000)': 'உதா: சில்வர் 100-நாள் திட்டம் (₹20,000)',
  'optional plan description...': 'விருப்பமான திட்ட விளக்கம்...',
};

export function getTranslation(key: string, lang: Language, fallback?: string): string {
  if (lang === 'en') {
    const item = translations[key];
    if (item && item.en) return item.en;
    return fallback || key;
  }

  // Tamil translation resolution
  const item = translations[key];
  if (item && item.ta) {
    return item.ta;
  }

  // Check normalized direct English phrase dictionary
  const normalizedKey = key.trim().toLowerCase();
  if (englishToTamilMap[normalizedKey]) {
    return englishToTamilMap[normalizedKey];
  }

  if (fallback) {
    const normalizedFallback = fallback.trim().toLowerCase();
    if (englishToTamilMap[normalizedFallback]) {
      return englishToTamilMap[normalizedFallback];
    }
  }

  return item?.en || fallback || key;
}

