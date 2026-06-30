import React, { createContext, useContext, useState } from 'react';

// Professional English + Hindi translations.
export const translations = {
  en: {
    // App / brand
    'app.brand': 'Galaxy Trust',
    'app.fullName': 'Galaxy Educational & Social Welfare Trust',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.feed': 'Feed',
    'nav.members': 'Members',
    'nav.contributions': 'Contributions',
    'nav.expenses': 'Expenses',
    'nav.staff': 'Staff',
    'nav.installments': 'Installments',
    'nav.meetings': 'Meetings',
    'nav.reports': 'Reports',
    'nav.profile': 'Profile',
    'action.logout': 'Logout',

    // Common
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.saveChanges': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.print': 'Print',
    'common.printAll': 'Print All',
    'common.view': 'View',
    'common.hide': 'Hide',
    'common.send': 'Send',
    'common.search': 'Search',
    'common.from': 'From',
    'common.to': 'To',
    'common.clearFilters': 'Clear Filters',
    'common.actions': 'Actions',
    'common.loading': 'Loading…',
    'common.loadMore': 'Load more',
    'common.none': 'None',
    'common.noRecords': 'No records found',
    'common.confirmDelete': 'Are you sure you want to delete this?',

    // Field labels
    'field.name': 'Name',
    'field.role': 'Role',
    'field.date': 'Date',
    'field.amount': 'Amount',
    'field.mode': 'Mode',
    'field.remarks': 'Remarks',
    'field.status': 'Status',
    'field.total': 'Total',
    'field.paid': 'Paid',
    'field.balance': 'Balance',
    'field.dueDate': 'Due Date',
    'field.category': 'Category',
    'field.description': 'Description',
    'field.contact': 'Contact',
    'field.address': 'Address',
    'field.phone': 'Phone',
    'field.relation': 'Father / Husband Name',
    'field.usedFor': 'Used For',
    'field.location': 'Location',
    'field.subject': 'Subject',
    'field.notes': 'Notes',
    'field.type': 'Type',
    'field.details': 'Details',

    // Statuses
    'status.paid': 'Paid',
    'status.pending': 'Pending',
    'status.overdue': 'Overdue',
    'status.partial': 'Partial',

    // Payment modes
    'mode.cash': 'Cash',
    'mode.online': 'Online',
    'mode.cheque': 'Cheque',

    // Roles
    'role.superadmin': 'Super Admin',
    'role.president': 'President',
    'role.secretary': 'Secretary',
    'role.treasurer': 'Treasurer',
    'role.trustee': 'Trustee',
    'role.admin': 'Admin',
    'role.manager': 'Manager',
    'role.viewer': 'Viewer',

    // Login
    'login.subtitle': 'Educational & Social Welfare Trust',
    'login.username': 'Username',
    'login.identifier': 'Username or Mobile',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.signingIn': 'Signing in…',
    'login.note': 'Secure access · authorized members only',
    'login.forgotPassword': 'Forgot Password?',
    'login.enterPhone': 'Registered phone number',
    'login.sendOtp': 'Send OTP',
    'login.sendingOtp': 'Sending…',
    'login.enterOtp': 'Enter OTP',
    'login.newPassword': 'New password (min 6 characters)',
    'login.resetPassword': 'Reset Password',
    'login.resetting': 'Resetting…',
    'login.backToLogin': 'Back to Sign In',
    'login.otpSent': 'OTP sent to your phone.',
    'login.resetSuccess': 'Password reset successful. Please sign in.',

    // Dashboard
    'dash.welcome': 'Welcome back',
    'dash.subtitle': 'Trust financial overview',
    'dash.totalContribution': 'Total Contributions',
    'dash.totalExpenseAll': 'Total Expenses (Other + Staff)',
    'dash.otherExpense': 'Other Expenses',
    'dash.staffPaid': 'Staff Paid',
    'dash.balance': 'Current Balance',
    'dash.members': 'Total Members',
    'dash.meetings': 'Total Meetings',
    'dash.pending': 'Pending Installments',
    'dash.fundUsage': 'Fund Usage Breakdown',
    'dash.totalUsed': 'Total used',

    // Members
    'members.title': 'Members',
    'members.add': 'Add Member',
    'members.searchPlaceholder': 'Search by name, address or phone',
    'members.detailTitle': 'Member Details',
    'members.installmentPlans': 'Installment Plans',
    'members.contributionsHeading': 'Contributions',
    'members.attendance': 'Meeting Attendance',
    'members.present': 'Present',
    'members.absent': 'Absent',
    'members.totalGiven': 'Total Contributed',

    // Contributions
    'contrib.title': 'Contributions',
    'contrib.add': 'Add Contribution',
    'contrib.member': 'Member',
    'contrib.selectMember': 'Select member with a pending installment',
    'contrib.noPending': 'No member has a pending installment.',
    'contrib.pendingInstallments': "Pending installments for",
    'contrib.amountPaying': 'Amount being paid',
    'contrib.savePayment': 'Save Payment',
    'contrib.searchPlaceholder': 'Search member or remarks',
    'contrib.paymentSaved': 'Payment saved for',
    'contrib.printReceipt': 'Print Receipt',
    'contrib.dismiss': 'Dismiss',
    'contrib.installmentType': 'Installment Type',

    // Expenses
    'exp.title': 'Expenses',
    'exp.add': 'Add Expense',
    'exp.addStaffPayment': 'Add Staff Payment',
    'exp.tabStaff': 'Staff',
    'exp.tabOther': 'Other',
    'exp.fundAvailable': 'Total Fund Available',
    'exp.totalIn': 'Total Contributions (In)',
    'exp.totalExpenseAll': 'Total Expenses (Other + Staff)',
    'exp.otherOut': 'Other Expenses (Out)',
    'exp.staffOut': 'Staff Paid (Out)',
    'exp.selectStaff': 'Select Staff',
    'exp.searchPlaceholder': 'Search category, used for or description',
    'exp.searchStaff': 'Search staff name or category',
    'exp.staffSummaryNote': 'Staff payment summary. Open the Staff page for full history.',
    'exp.totalPaid': 'Total Paid',
    'exp.noStaff': 'No staff added yet.',

    // Staff
    'staff.title': 'Staff',
    'staff.add': 'Add Staff',
    'staff.searchPlaceholder': 'Search staff name, category or contact',
    'staff.payments': 'Payments',
    'staff.paymentHistory': 'Payment History',
    'staff.addPayment': 'Add Payment',
    'staff.noPayments': 'No payments recorded yet.',
    'staff.confirmDelete': 'Delete this staff member? All their payment records will also be removed.',

    // Installments
    'inst.title': 'Installments',
    'inst.set': 'Set Installment',
    'inst.setFor': 'Save for {n} member(s)',
    'inst.selectMembers': 'Select members (multiple allowed)',
    'inst.typePlaceholder': 'Installment type (e.g. Membership Fee, Building Fund)',
    'inst.totalPlaceholder': 'Total amount (same for all)',
    'inst.searchPlaceholder': 'Search member, type or notes',
    'inst.dueFrom': 'Due From',
    'inst.dueTo': 'Due To',

    // Meetings
    'meet.title': 'Meetings',
    'meet.add': 'Add Meeting',
    'meet.attendance': 'Attendance',
    'meet.searchPlaceholder': 'Search location, subject or description',
    'meet.present': 'Present',
    'meet.absent': 'Absent',

    // Reports
    'rep.title': 'Reports',
    'rep.installmentsByMember': 'Installment Plans by Member',
    'rep.plans': 'Plans',
    'rep.totalDue': 'Total Due',
    'rep.totalPaid': 'Total Paid',
    'rep.totalBalance': 'Total Balance',
    'rep.installmentsByType': 'Installments by Type',
    'rep.contributionLedger': 'Member Contribution Ledger',
    'rep.totalGiven': 'Total Given',
    'rep.contributionReport': 'Contribution Report',
    'rep.totalContributed': 'Total Contributed',
    'rep.payments': 'Payments',
    'rep.expenseReport': 'Expense Report',
    'rep.entries': 'Entries',
    'rep.pendingInstallments': 'Pending Installments',

    // Profile
    'profile.title': 'Profile',
    'profile.username': 'Username',
    'profile.changePassword': 'Change Password',
    'profile.current': 'Current Password',
    'profile.new': 'New Password (min 8 characters)',
    'profile.confirm': 'Confirm New Password',
    'profile.update': 'Update Password',
    'profile.updating': 'Updating…',
    'profile.mismatch': 'New password and confirmation do not match.',
    'profile.tooShort': 'New password must be at least 8 characters.',
    'profile.success': 'Password updated successfully.',

    // Feed
    'feed.title': 'Feed',
    'feed.justNow': 'now',
    'feed.composerPlaceholder': "What's on your mind, {name}?",
    'feed.photos': 'Photos',
    'feed.locationPlaceholder': 'Location (optional)',
    'feed.tag': 'Tag members / staff',
    'feed.searchName': 'Search name',
    'feed.post': 'Post',
    'feed.posting': 'Posting…',
    'feed.noPosts': 'No posts yet. Be the first to share.',
    'feed.loading': 'Loading feed…',
    'feed.edited': 'edited',
    'feed.editsLeft': '{n} edit(s) remaining (limit {max})',
    'feed.changePhotos': 'Add Photos',
    'feed.commentPlaceholder': 'Write a comment…',
    'feed.maxImages': 'A maximum of {max} images is allowed.',
    'feed.staffTag': 'staff',
    'feed.imageOnly': 'Please select an image file.',
    'feed.imageError': 'Could not load the image.',
    'feed.textOrPhoto': 'Add some text or a photo.',
    'feed.posted': 'Posted',
    'feed.postUpdated': 'Post updated',
    'feed.postDeleted': 'Post deleted',
    'feed.confirmDeletePost': 'Delete this post?',

    // Permissions
    'nav.permissions': 'Permissions',
    'perm.title': 'Permissions',
    'perm.subtitle': 'Assign a login permission role to each member.',
    'perm.member': 'Member',
    'perm.designation': 'Designation',
    'perm.loginRole': 'Login Role',
    'perm.noLogin': 'No login account',
    'perm.assign': 'Assign',
    'perm.updated': 'Role updated',
    'perm.note': 'The member must sign in again for the new role to take effect.',
    'perm.actions': 'Actions',
    'perm.resetPassword': 'Reset Password',
    'perm.resetConfirm': "Reset this member's password?",
    'perm.newPassword': 'New password (shown once — copy & share)',
    'perm.copy': 'Copy',
    'perm.copied': 'Copied!',

    // Cashier
    'nav.cashier': 'Cashier',
    'dash.cashierIn': 'Cashier Collected (In)',
    'dash.cashierOut': 'Cashier Disbursed (Out)',
    'cashier.title': 'Cashiers',
    'cashier.subtitle': 'Designate members as cashiers and track money they collect and disburse.',
    'cashier.add': 'Add Cashier',
    'cashier.makeCashier': 'Make Cashier',
    'cashier.cashier': 'Cashier',
    'cashier.totalIn': 'Collected (In)',
    'cashier.totalOut': 'Disbursed (Out)',
    'cashier.receivedFrom': 'Received From',
    'cashier.givenTo': 'Given To',
    'cashier.remove': 'Remove',
    'cashier.removeConfirm': 'Remove this member as a cashier? Past records are kept.',
    'cashier.added': 'Cashier added',
    'cashier.removed': 'Cashier removed',
    'cashier.noneYet': 'No cashiers added yet.',
    'cashier.allAdded': 'All members are already cashiers.',
    'cashier.selectCashiers': 'Cashiers (select one or more)',
    'cashier.allocated': 'Allocated',
    'cashier.splitHint': 'Ticked cashiers share the amount equally. Edit any amount to lock it; the rest auto-adjust.',
    'cashier.resetSplit': 'Reset to equal',
    'cashier.manual': 'Manually set',
    'cashier.auto': 'Auto-calculated',
    'cashier.mismatch': 'Allocated total does not match the amount.',
    'cashier.report': 'Cashier Report',
    'cashier.gaveToCashiers': 'Money Given To Cashier(s)',
    'cashier.asCashier': 'As Cashier',

    // Navigation (new features)
    'nav.search': 'Search',
    'nav.announcements': 'Notice Board',
    'nav.activity': 'Activity Log',

    // Announcements
    'ann.title': 'Notice Board',
    'ann.add': 'New Notice',
    'ann.edit': 'Edit Notice',
    'ann.titleField': 'Title',
    'ann.bodyField': 'Write the notice…',
    'ann.pin': 'Pin to top',
    'ann.none': 'No notices yet.',
    'ann.saved': 'Notice saved',
    'ann.deleted': 'Notice deleted',
    'ann.titleRequired': 'Title is required',

    // Activity log
    'activity.title': 'Activity Log',
    'activity.user': 'User',
    'activity.action': 'Action',
    'activity.ip': 'IP Address',
    'activity.allActions': 'All actions',
    'activity.total': 'Total',

    // Backup
    'backup.button': 'Backup',
    'backup.done': 'Backup downloaded',

    // Search
    'search.title': 'Search',
    'search.placeholder': 'Search members, contributions, expenses…',
    'search.minChars': 'Type at least 2 characters.',
    'search.openPage': 'Open page',
    'search.found': '{n} result(s) found',

    // Members (new)
    'members.dob': 'Date of Birth',
    'members.photo': 'Photo',
    'members.active': 'Active',
    'members.inactive': 'Inactive',
    'members.allStatus': 'All',
    'members.activate': 'Activate',
    'members.deactivate': 'Deactivate',
    'members.idCard': 'ID Card',
    'members.passbook': 'Passbook',
    'members.imageOnly': 'Please select an image file.',
    'members.imageError': 'Could not load the image.',

    // Dashboard (new)
    'dash.monthlyTrend': 'Monthly Trend (last 12 months)',
    'dash.income': 'Income',
    'dash.outflow': 'Outflow',
    'dash.birthdays': 'Upcoming Birthdays',
    'dash.today': 'Today 🎉',
    'dash.inDays': 'in {n} day(s)',

    // Reports (new)
    'rep.annual': 'Annual Statement',
    'rep.month': 'Month',
    'rep.totalIncome': 'Total Income',
    'rep.totalOut': 'Total Outflow',
    'rep.net': 'Net',

    // Meetings (new)
    'meet.minutes': 'Minutes of Meeting',
    'meet.mom': 'Minutes (MOM)',
  },

  hi: {
    'app.brand': 'गैलेक्सी ट्रस्ट',
    'app.fullName': 'गैलेक्सी शैक्षिक एवं सामाजिक कल्याण ट्रस्ट',

    'nav.dashboard': 'डैशबोर्ड',
    'nav.feed': 'फ़ीड',
    'nav.members': 'सदस्य',
    'nav.contributions': 'योगदान',
    'nav.expenses': 'व्यय',
    'nav.staff': 'कर्मचारी',
    'nav.installments': 'किश्तें',
    'nav.meetings': 'बैठकें',
    'nav.reports': 'रिपोर्ट',
    'nav.profile': 'प्रोफ़ाइल',
    'action.logout': 'लॉग आउट',

    'common.add': 'जोड़ें',
    'common.edit': 'संपादित करें',
    'common.delete': 'हटाएं',
    'common.save': 'सहेजें',
    'common.saveChanges': 'परिवर्तन सहेजें',
    'common.cancel': 'रद्द करें',
    'common.print': 'प्रिंट करें',
    'common.printAll': 'सभी प्रिंट करें',
    'common.view': 'देखें',
    'common.hide': 'छिपाएं',
    'common.send': 'भेजें',
    'common.search': 'खोजें',
    'common.from': 'से',
    'common.to': 'तक',
    'common.clearFilters': 'फ़िल्टर हटाएं',
    'common.actions': 'क्रियाएं',
    'common.loading': 'लोड हो रहा है…',
    'common.loadMore': 'और देखें',
    'common.none': 'कोई नहीं',
    'common.noRecords': 'कोई रिकॉर्ड नहीं मिला',
    'common.confirmDelete': 'क्या आप इसे हटाना चाहते हैं?',

    'field.name': 'नाम',
    'field.role': 'भूमिका',
    'field.date': 'तारीख',
    'field.amount': 'राशि',
    'field.mode': 'माध्यम',
    'field.remarks': 'टिप्पणी',
    'field.status': 'स्थिति',
    'field.total': 'कुल',
    'field.paid': 'भुगतान',
    'field.balance': 'शेष',
    'field.dueDate': 'नियत तारीख',
    'field.category': 'श्रेणी',
    'field.description': 'विवरण',
    'field.contact': 'संपर्क',
    'field.address': 'पता',
    'field.phone': 'फ़ोन',
    'field.relation': 'पिता / पति का नाम',
    'field.usedFor': 'किस कार्य हेतु',
    'field.location': 'स्थान',
    'field.subject': 'विषय',
    'field.notes': 'टिप्पणियाँ',
    'field.type': 'प्रकार',
    'field.details': 'विवरण',

    'status.paid': 'भुगतान पूर्ण',
    'status.pending': 'बकाया',
    'status.overdue': 'अतिदेय',
    'status.partial': 'आंशिक',

    'mode.cash': 'नकद',
    'mode.online': 'ऑनलाइन',
    'mode.cheque': 'चेक',

    'role.superadmin': 'सुपर एडमिन',
    'role.president': 'अध्यक्ष',
    'role.secretary': 'सचिव',
    'role.treasurer': 'कोषाध्यक्ष',
    'role.trustee': 'न्यासी',
    'role.admin': 'एडमिन',
    'role.manager': 'प्रबंधक',
    'role.viewer': 'व्यूअर',

    'login.subtitle': 'शैक्षिक एवं सामाजिक कल्याण ट्रस्ट',
    'login.username': 'उपयोगकर्ता नाम',
    'login.identifier': 'उपयोगकर्ता नाम या मोबाइल',
    'login.password': 'पासवर्ड',
    'login.signIn': 'साइन इन करें',
    'login.signingIn': 'साइन इन हो रहा है…',
    'login.note': 'सुरक्षित पहुँच · केवल अधिकृत सदस्य',
    'login.forgotPassword': 'पासवर्ड भूल गए?',
    'login.enterPhone': 'पंजीकृत फ़ोन नंबर',
    'login.sendOtp': 'OTP भेजें',
    'login.sendingOtp': 'भेज रहे हैं…',
    'login.enterOtp': 'OTP दर्ज करें',
    'login.newPassword': 'नया पासवर्ड (न्यूनतम 6 अक्षर)',
    'login.resetPassword': 'पासवर्ड रीसेट करें',
    'login.resetting': 'रीसेट हो रहा है…',
    'login.backToLogin': 'साइन इन पर वापस',
    'login.otpSent': 'OTP आपके फ़ोन पर भेजा गया।',
    'login.resetSuccess': 'पासवर्ड रीसेट हो गया। कृपया साइन इन करें।',

    'dash.welcome': 'पुनः स्वागत है',
    'dash.subtitle': 'ट्रस्ट वित्तीय अवलोकन',
    'dash.totalContribution': 'कुल योगदान',
    'dash.totalExpenseAll': 'कुल व्यय (अन्य + कर्मचारी)',
    'dash.otherExpense': 'अन्य व्यय',
    'dash.staffPaid': 'कर्मचारी भुगतान',
    'dash.balance': 'वर्तमान शेष',
    'dash.members': 'कुल सदस्य',
    'dash.meetings': 'कुल बैठकें',
    'dash.pending': 'बकाया किश्तें',
    'dash.fundUsage': 'निधि उपयोग विवरण',
    'dash.totalUsed': 'कुल उपयोग',

    'members.title': 'सदस्य',
    'members.add': 'सदस्य जोड़ें',
    'members.searchPlaceholder': 'नाम, पता या फ़ोन से खोजें',
    'members.detailTitle': 'सदस्य विवरण',
    'members.installmentPlans': 'किश्त योजनाएं',
    'members.contributionsHeading': 'योगदान',
    'members.attendance': 'बैठक उपस्थिति',
    'members.present': 'उपस्थित',
    'members.absent': 'अनुपस्थित',
    'members.totalGiven': 'कुल योगदान',

    'contrib.title': 'योगदान',
    'contrib.add': 'योगदान जोड़ें',
    'contrib.member': 'सदस्य',
    'contrib.selectMember': 'बकाया किश्त वाले सदस्य का चयन करें',
    'contrib.noPending': 'किसी सदस्य की किश्त बकाया नहीं है।',
    'contrib.pendingInstallments': 'बकाया किश्तें —',
    'contrib.amountPaying': 'भुगतान की जा रही राशि',
    'contrib.savePayment': 'भुगतान सहेजें',
    'contrib.searchPlaceholder': 'सदस्य या टिप्पणी खोजें',
    'contrib.paymentSaved': 'भुगतान सहेजा गया —',
    'contrib.printReceipt': 'रसीद प्रिंट करें',
    'contrib.dismiss': 'बंद करें',
    'contrib.installmentType': 'किश्त प्रकार',

    'exp.title': 'व्यय',
    'exp.add': 'व्यय जोड़ें',
    'exp.addStaffPayment': 'कर्मचारी भुगतान जोड़ें',
    'exp.tabStaff': 'कर्मचारी',
    'exp.tabOther': 'अन्य',
    'exp.fundAvailable': 'उपलब्ध कुल निधि',
    'exp.totalIn': 'कुल योगदान (आय)',
    'exp.totalExpenseAll': 'कुल व्यय (अन्य + कर्मचारी)',
    'exp.otherOut': 'अन्य व्यय (व्यय)',
    'exp.staffOut': 'कर्मचारी भुगतान (व्यय)',
    'exp.selectStaff': 'कर्मचारी चुनें',
    'exp.searchPlaceholder': 'श्रेणी, कार्य या विवरण खोजें',
    'exp.searchStaff': 'कर्मचारी नाम या श्रेणी खोजें',
    'exp.staffSummaryNote': 'कर्मचारी भुगतान सारांश। पूर्ण इतिहास हेतु कर्मचारी पृष्ठ खोलें।',
    'exp.totalPaid': 'कुल भुगतान',
    'exp.noStaff': 'अभी तक कोई कर्मचारी नहीं जोड़ा गया।',

    'staff.title': 'कर्मचारी',
    'staff.add': 'कर्मचारी जोड़ें',
    'staff.searchPlaceholder': 'कर्मचारी नाम, श्रेणी या संपर्क खोजें',
    'staff.payments': 'भुगतान',
    'staff.paymentHistory': 'भुगतान इतिहास',
    'staff.addPayment': 'भुगतान जोड़ें',
    'staff.noPayments': 'अभी तक कोई भुगतान दर्ज नहीं।',
    'staff.confirmDelete': 'इस कर्मचारी को हटाएं? उनके सभी भुगतान रिकॉर्ड भी हट जाएंगे।',

    'inst.title': 'किश्तें',
    'inst.set': 'किश्त निर्धारित करें',
    'inst.setFor': '{n} सदस्य हेतु सहेजें',
    'inst.selectMembers': 'सदस्य चुनें (एक से अधिक संभव)',
    'inst.typePlaceholder': 'किश्त प्रकार (जैसे सदस्यता शुल्क, भवन निधि)',
    'inst.totalPlaceholder': 'कुल राशि (सभी हेतु समान)',
    'inst.searchPlaceholder': 'सदस्य, प्रकार या टिप्पणी खोजें',
    'inst.dueFrom': 'नियत तारीख से',
    'inst.dueTo': 'नियत तारीख तक',

    'meet.title': 'बैठकें',
    'meet.add': 'बैठक जोड़ें',
    'meet.attendance': 'उपस्थिति',
    'meet.searchPlaceholder': 'स्थान, विषय या विवरण खोजें',
    'meet.present': 'उपस्थित',
    'meet.absent': 'अनुपस्थित',

    'rep.title': 'रिपोर्ट',
    'rep.installmentsByMember': 'सदस्य अनुसार किश्त योजनाएं',
    'rep.plans': 'योजनाएं',
    'rep.totalDue': 'कुल देय',
    'rep.totalPaid': 'कुल भुगतान',
    'rep.totalBalance': 'कुल शेष',
    'rep.installmentsByType': 'प्रकार अनुसार किश्तें',
    'rep.contributionLedger': 'सदस्य योगदान बही',
    'rep.totalGiven': 'कुल योगदान',
    'rep.contributionReport': 'योगदान रिपोर्ट',
    'rep.totalContributed': 'कुल योगदान',
    'rep.payments': 'भुगतान',
    'rep.expenseReport': 'व्यय रिपोर्ट',
    'rep.entries': 'प्रविष्टियाँ',
    'rep.pendingInstallments': 'बकाया किश्तें',

    'profile.title': 'प्रोफ़ाइल',
    'profile.username': 'उपयोगकर्ता नाम',
    'profile.changePassword': 'पासवर्ड बदलें',
    'profile.current': 'वर्तमान पासवर्ड',
    'profile.new': 'नया पासवर्ड (न्यूनतम 8 अक्षर)',
    'profile.confirm': 'नए पासवर्ड की पुष्टि करें',
    'profile.update': 'पासवर्ड अपडेट करें',
    'profile.updating': 'अपडेट हो रहा है…',
    'profile.mismatch': 'नया पासवर्ड और पुष्टि मेल नहीं खाते।',
    'profile.tooShort': 'नया पासवर्ड कम से कम 8 अक्षर का होना चाहिए।',
    'profile.success': 'पासवर्ड सफलतापूर्वक अपडेट हुआ।',

    'feed.title': 'फ़ीड',
    'feed.justNow': 'अभी',
    'feed.composerPlaceholder': 'आप क्या साझा करना चाहेंगे, {name}?',
    'feed.photos': 'फ़ोटो',
    'feed.locationPlaceholder': 'स्थान (वैकल्पिक)',
    'feed.tag': 'सदस्य / कर्मचारी टैग करें',
    'feed.searchName': 'नाम खोजें',
    'feed.post': 'पोस्ट करें',
    'feed.posting': 'पोस्ट हो रहा है…',
    'feed.noPosts': 'अभी तक कोई पोस्ट नहीं। पहली पोस्ट साझा करें।',
    'feed.loading': 'फ़ीड लोड हो रही है…',
    'feed.edited': 'संपादित',
    'feed.editsLeft': '{n} संपादन शेष (सीमा {max})',
    'feed.changePhotos': 'फ़ोटो जोड़ें',
    'feed.commentPlaceholder': 'टिप्पणी लिखें…',
    'feed.maxImages': 'अधिकतम {max} फ़ोटो जोड़ी जा सकती हैं।',
    'feed.staffTag': 'कर्मचारी',
    'feed.imageOnly': 'कृपया एक छवि फ़ाइल चुनें।',
    'feed.imageError': 'छवि लोड नहीं हो सकी।',
    'feed.textOrPhoto': 'कुछ टेक्स्ट या फ़ोटो जोड़ें।',
    'feed.posted': 'पोस्ट हो गया',
    'feed.postUpdated': 'पोस्ट अपडेट हुई',
    'feed.postDeleted': 'पोस्ट हटाई गई',
    'feed.confirmDeletePost': 'यह पोस्ट हटाएं?',

    // Permissions
    'nav.permissions': 'अनुमतियाँ',
    'perm.title': 'अनुमतियाँ',
    'perm.subtitle': 'प्रत्येक सदस्य को लॉगिन अनुमति भूमिका दें।',
    'perm.member': 'सदस्य',
    'perm.designation': 'पदनाम',
    'perm.loginRole': 'लॉगिन भूमिका',
    'perm.noLogin': 'कोई लॉगिन खाता नहीं',
    'perm.assign': 'निर्धारित करें',
    'perm.updated': 'भूमिका अपडेट हुई',
    'perm.note': 'नई भूमिका लागू होने के लिए सदस्य को फिर से साइन इन करना होगा।',
    'perm.actions': 'क्रियाएं',
    'perm.resetPassword': 'पासवर्ड रीसेट',
    'perm.resetConfirm': 'इस सदस्य का पासवर्ड रीसेट करें?',
    'perm.newPassword': 'नया पासवर्ड (एक बार दिखेगा — कॉपी करके साझा करें)',
    'perm.copy': 'कॉपी',
    'perm.copied': 'कॉपी हो गया!',

    // Cashier
    'nav.cashier': 'कैशियर',
    'dash.cashierIn': 'कैशियर द्वारा प्राप्त (आय)',
    'dash.cashierOut': 'कैशियर द्वारा वितरित (व्यय)',
    'cashier.title': 'कैशियर',
    'cashier.subtitle': 'सदस्यों को कैशियर बनाएं और उनके द्वारा ली व दी गई राशि ट्रैक करें।',
    'cashier.add': 'कैशियर जोड़ें',
    'cashier.makeCashier': 'कैशियर बनाएं',
    'cashier.cashier': 'कैशियर',
    'cashier.totalIn': 'प्राप्त (आय)',
    'cashier.totalOut': 'वितरित (व्यय)',
    'cashier.receivedFrom': 'किससे प्राप्त',
    'cashier.givenTo': 'किसको दिया',
    'cashier.remove': 'हटाएं',
    'cashier.removeConfirm': 'इस सदस्य को कैशियर से हटाएं? पुराने रिकॉर्ड सुरक्षित रहेंगे।',
    'cashier.added': 'कैशियर जोड़ा गया',
    'cashier.removed': 'कैशियर हटाया गया',
    'cashier.noneYet': 'अभी तक कोई कैशियर नहीं जोड़ा गया।',
    'cashier.allAdded': 'सभी सदस्य पहले से कैशियर हैं।',
    'cashier.selectCashiers': 'कैशियर (एक या अधिक चुनें)',
    'cashier.allocated': 'आवंटित',
    'cashier.splitHint': 'चुने गए कैशियर राशि बराबर बाँटते हैं। किसी राशि को बदलें तो वह लॉक हो जाएगी; बाकी अपने आप समायोजित होंगी।',
    'cashier.resetSplit': 'बराबर पर रीसेट करें',
    'cashier.manual': 'मैन्युअल रूप से सेट',
    'cashier.auto': 'स्वतः गणना',
    'cashier.mismatch': 'आवंटित कुल राशि से मेल नहीं खाता।',
    'cashier.report': 'कैशियर रिपोर्ट',
    'cashier.gaveToCashiers': 'कैशियर को दी गई राशि',
    'cashier.asCashier': 'कैशियर के रूप में',

    // Navigation (new features)
    'nav.search': 'खोज',
    'nav.announcements': 'सूचना पट्ट',
    'nav.activity': 'गतिविधि लॉग',

    // Announcements
    'ann.title': 'सूचना पट्ट',
    'ann.add': 'नई सूचना',
    'ann.edit': 'सूचना संपादित करें',
    'ann.titleField': 'शीर्षक',
    'ann.bodyField': 'सूचना लिखें…',
    'ann.pin': 'ऊपर पिन करें',
    'ann.none': 'अभी तक कोई सूचना नहीं।',
    'ann.saved': 'सूचना सहेजी गई',
    'ann.deleted': 'सूचना हटाई गई',
    'ann.titleRequired': 'शीर्षक आवश्यक है',

    // Activity log
    'activity.title': 'गतिविधि लॉग',
    'activity.user': 'उपयोगकर्ता',
    'activity.action': 'क्रिया',
    'activity.ip': 'IP पता',
    'activity.allActions': 'सभी क्रियाएं',
    'activity.total': 'कुल',

    // Backup
    'backup.button': 'बैकअप',
    'backup.done': 'बैकअप डाउनलोड हुआ',

    // Search
    'search.title': 'खोज',
    'search.placeholder': 'सदस्य, योगदान, व्यय खोजें…',
    'search.minChars': 'कम से कम 2 अक्षर लिखें।',
    'search.openPage': 'पृष्ठ खोलें',
    'search.found': '{n} परिणाम मिले',

    // Members (new)
    'members.dob': 'जन्म तिथि',
    'members.photo': 'फ़ोटो',
    'members.active': 'सक्रिय',
    'members.inactive': 'निष्क्रिय',
    'members.allStatus': 'सभी',
    'members.activate': 'सक्रिय करें',
    'members.deactivate': 'निष्क्रिय करें',
    'members.idCard': 'पहचान पत्र',
    'members.passbook': 'पासबुक',
    'members.imageOnly': 'कृपया एक छवि फ़ाइल चुनें।',
    'members.imageError': 'छवि लोड नहीं हो सकी।',

    // Dashboard (new)
    'dash.monthlyTrend': 'मासिक रुझान (पिछले 12 महीने)',
    'dash.income': 'आय',
    'dash.outflow': 'व्यय',
    'dash.birthdays': 'आगामी जन्मदिन',
    'dash.today': 'आज 🎉',
    'dash.inDays': '{n} दिन में',

    // Reports (new)
    'rep.annual': 'वार्षिक विवरण',
    'rep.month': 'महीना',
    'rep.totalIncome': 'कुल आय',
    'rep.totalOut': 'कुल व्यय',
    'rep.net': 'शुद्ध',

    // Meetings (new)
    'meet.minutes': 'बैठक का कार्यवृत्त',
    'meet.mom': 'कार्यवृत्त (MOM)',
  },
};

const I18nContext = createContext(null);

export function getInitialLang() {
  try {
    const saved = localStorage.getItem('galaxy_lang');
    if (saved === 'en' || saved === 'hi') return saved;
  } catch (e) {
    /* ignore */
  }
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang());

  const setLang = (l) => {
    try {
      localStorage.setItem('galaxy_lang', l);
    } catch (e) {
      /* ignore */
    }
    document.documentElement.setAttribute('lang', l);
    setLangState(l);
  };

  // t(key, vars?) — falls back to English, then the key itself.
  const t = (key, vars) => {
    let str = (translations[lang] && translations[lang][key]) || translations.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return str;
  };

  return React.createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { lang: 'en', setLang: () => {}, t: (k) => translations.en[k] || k };
  }
  return ctx;
}

// Translate a role value (used widely for badges)
export function roleLabel(t, role) {
  return t(`role.${role}`) || role;
}
