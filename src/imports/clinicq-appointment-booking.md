Modify the existing ClinicQ web app (currently direct “Join Queue” system) to support slot-wise appointment booking before queue entry.

IMPORTANT:

Do NOT redesign the entire app.

Keep current layout structure, color palette, and branding.

Only enhance necessary screens.

Make the entire app fully responsive (Desktop + Tablet + Mobile).

🔄 1️⃣ Replace “Join Queue” with Slot Booking

On the Doctor Detail Page:

ADD:

📅 Slot Booking Section

Below doctor information, add:

A) Date Picker

Clean calendar selector

Highlight selected date

Disable past dates

B) Time Slot Grid

Display 10-minute interval slots

Grid layout for desktop

Wrapped stacked layout for mobile

Slot states:

Green → Available

Grey → Booked

Light red → Past

Blue outline → Selected

On selecting slot:
Show booking summary card:

Doctor name

Date

Time

Primary button:

“Book Appointment”

👤 2️⃣ Add “My Appointments” Page (Patient)

Add sidebar item:

My Appointments

Layout:
Card-based design

Each appointment card shows:

Doctor name

Clinic name

Date

Time

Status badge:

Booked (blue)

Checked-in (green)

Completed (grey)

Cancelled (red)

Buttons:

Cancel Appointment

Check In (active 15 minutes before slot)

Mobile:

Stack details vertically

Buttons full-width

⏱ 3️⃣ Check-In → Queue Status Integration

After user clicks “Check In”:

Redirect to existing Queue Status page.

Display:

Token number

Queue position

Estimated wait time

Live progress indicator

Ensure mobile-friendly layout:

Large token display

Clear status indicator

Sticky bottom action button if needed

🏥 4️⃣ Clinic Dashboard Update (Minimal Changes)

On Doctors Page:

Add:

“Set Availability” button

Availability Modal:

Fields:

Working days toggle (Mon–Sun)

Start time

End time

Slot duration dropdown (10 / 15 / 20 mins)

Save button

Make modal responsive:

Centered on desktop

Full-screen modal on mobile

📱 5️⃣ FULL RESPONSIVENESS REQUIREMENT

Make the entire app responsive:

Desktop (1200px+)

Sidebar fixed left

Grid layouts

Multi-column slot grid

Tablet (768px–1199px)

Collapsible sidebar

2-column slot grid

Adjust card widths

Mobile (<768px)

Sidebar becomes hamburger menu

Single-column layout

Slot buttons full width

Cards stacked vertically

Sticky bottom primary actions

🎨 Design Guidelines

Maintain existing medical blue theme

12px–16px border radius

Soft shadows

Clean spacing system

Consistent typography scale

Smooth hover and tap animations

Accessible contrast ratios

✨ Include

Empty states (No appointments, No slots available)

Loading skeleton screens

Toast notifications for booking success

Confirmation modal before cancellation

Interactive prototype flow

🎯 Deliverables Required

Updated Doctor Detail page

New My Appointments page

Updated Clinic Doctors page (Availability modal)

Responsive versions (Desktop + Tablet + Mobile)

Clickable prototype:
Select Slot → Book → View Appointment → Check In → Queue Status