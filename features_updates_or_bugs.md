# Feature and Bug lists

## Features to Add
*(Add any new feature requests here)*
- [x] Add the option to sort by date in lists, make this off by default. Make sure the icon looks good both on phone, tablet and laptop. *(Resolved: Added "By Date" toggle with sortDate icon in list filter header, off by default)*
- [x] When showing the date under the tasks, The user might want to also show the day of the week, this should be configureable in the settings in a clean way (make sure the menus look good on all platforms!). For example the user might choose for the dates to look like چهارشنبه ۲۰ آبان under the tasks. *(Resolved: Added "Show Day of Week under Tasks" setting with live preview in SettingsModal across Shamsi, Islamic & Gregorian)*
- [x] On laptop, on the bottom line where you add the tasks, add the option to add dates and set priorities too (and make sure your implementation looks good) *(Resolved: Added quick due date calendar picker button with clear badge and priority dropdown selector with flag indicator on laptop/desktop)*

## Bugs to Fix
*(Add any new bug reports here)*
- [x] In the app, when scrolling in the lists list, after I remove my finger, something is pressed and the lists list is closed. This should obviously not be the case, the user might want more time to look the lists over and then select what they want! *(Resolved: Added scroll-vs-tap distance tracking in mobile list sheet so scrolling never triggers list selection or sheet closing)*
- [x] The desktop icon logo isn't matching the phone app again! Please fix it and make sure this does not happen again, this is the second time! *(Resolved: Restored unified Dual-Ring high-res icon matching Android mipmap launcher icons across desktop .desktop, web icon.png, icon.svg and all client/server public assets)*
- [x] When selecting a task and begining to move it, the exact task card should be moved, right now some of the task information dissapears when it's hovering (most importantly the date). Make it so the exact task card is moved around! *(Resolved: Floating drag card now renders complete metadata: due date badge with calendar formatting, priority flag, steps, list name, notes, and attachment)*

## Requests
*(Add any new design or general requests here)*
- [x] I would like to be able to hold anywhere on the task cards to pick them and move them around (right now in the app I have to select the left of them to move it, I want it to work anywhere on the app, This is working correctly for the laptop version.) *(Resolved: Added touch hold-to-drag timer anywhere on cards on phone/tablet, vibrating on pick up and smoothly lifting card for reordering)*