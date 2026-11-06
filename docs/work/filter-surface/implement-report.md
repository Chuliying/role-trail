# Filter surface and motion

The filter overlay now uses the shared dialog header, a quiet 44px close control and one 16px reading gutter. Fields have equal 48px heights; Reset and Apply use equal-width, 44px-minimum buttons. The existing neutral surface, indigo action and radius tokens remain unchanged.

Opening focuses the heading rather than auto-focusing the close button or opening a mobile keyboard. Keyboard controls retain their existing focus-visible treatment. On short viewports only the fields scroll, leaving the header and actions visible.

Desktop overlays fade and move slightly; mobile sheets enter over 240ms and exit over the shared 180ms token. The scrim fades with the panel. Closing makes the form inert, waits for finite CSS animations, then removes the modal and restores focus. Apply captures the draft before closing, renders once afterward and restores focus to the new trigger. Repeated close/apply events cannot double-commit. Escape, backdrop click and native cancel share the same path. Reduced motion skips exit waits and animations.

## Evidence

RED: both Chromium and WebKit failed the shared header assertion before implementation. Existing fixed-position geometry checks were updated to wait for the intentional entry animation. WebKit's native Tab order can focus the text input before the close button; the test verifies visible focus on the reached control instead of imposing Chromium's order.

Synthetic screenshots reviewed after entry. New tests cover motion names, title focus, keyboard focus indication, aligned gutters, cancel/reopen, apply/focus restoration, native cancel, reduced motion and a 320×400 viewport. No production state is used or modified by these tests.

Final build, full-suite and delivery results follow after execution.

Final verification: Node 22 build, 85 Node tests, 53 browser tests, formatting and whitespace checks passed. Audit reports zero vulnerabilities. Secret preflight passed with only the existing synthetic suppressions and unchanged vendored marked warning. No dependency or authentication changes. Chromium and WebKit screenshots show the same settled surface.
