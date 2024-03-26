@core @core_user @app @javascript
Feature: Test basic usage of user features

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | timezone |
      | student1 | Student   | Student  | 99       |

  Scenario: Complete missing fields
    Given the following "custom profile fields" exist:
      | datatype | shortname  | name           | required | param1 |
      | text     | food       | Favourite food | 1        |        |
      | social   | website    | url            | 1        | url    |
    When I enter the app
    And I log in as "student1"
    Then I should find "Complete your profile" in the app
    And I should find "Before you continue, please fill in the required fields in your user profile." in the app

    When I press "Complete profile" in the app
    Then the app should have opened a browser tab with url "webserver"

    When I close the browser tab opened by the app
    Then I should find "If you didn't complete your profile correctly, you'll be asked to do it again." in the app
    But I should not find "Complete your profile" in the app

    When I press "Reconnect" in the app
    Then I should find "Complete your profile" in the app
    But I should not find "Reconnect" in the app

    When I press "Switch account" in the app
    Then I should find "Accounts" in the app
    And I should find "Student Student" in the app

    When I press "Student Student" in the app
    Then I should find "Complete your profile" in the app
    But I should not find "Reconnect" in the app

    When I press "Complete profile" in the app
    Then the app should have opened a browser tab with url "webserver"

    When I switch to the browser tab opened by the app
    And I set the field "username" to "student1"
    And I set the field "password" to "student1"
    And I click on "Log in" "button"
    And I set the field "Favourite food" to "Pasta"
    And I set the field "Web page" to "https://moodle.com"
    And I click on "Update profile" "button"
    Then I should see "Changes saved"

    When I close the browser tab opened by the app
    Then I should find "If you didn't complete your profile correctly, you'll be asked to do it again." in the app
    But I should not find "Complete your profile" in the app

    When I press "Reconnect" in the app
    Then I should find "Acceptance test site" in the app

  Scenario: View profile
    Given the following "custom profile fields" exist:
      | datatype | shortname  | name           | required | param1 |
      | text     | food       | Favourite food | 1        |        |
      | social   | website    | url            | 1        | url    |
    And I entered the app as "student1"
    And I press "Complete profile" in the app
    And I switch to the browser tab opened by the app
    And I set the field "username" to "student1"
    And I set the field "password" to "student1"
    And I click on "Log in" "button"
    And I set the field "Favourite food" to "Pasta"
    And I set the field "Web page" to "https://moodle.com"
    When I click on "Update profile" "button"
    Then I should see "Changes saved"

    When I close the browser tab opened by the app
    And I press "Reconnect" in the app
    And I press the user menu button in the app
    And I press "Student" in the app
    Then I should find "student1@example.com" in the app
    And I should find "Student Student" in the app
    And I should find "Pasta" in the app
    And I should find "https://moodle.com" in the app
    And the UI should match the snapshot

  @lms_from4.2
  Scenario: View timezone in profile
    Given the following config values are set as admin:
      | timezone      | Europe/Madrid |
      | forcetimezone | 99            |
    And the following "users" exist:
      | username | firstname | lastname | timezone      |
      | student2 | John      | Smith    | Asia/Shanghai |
    And the following "courses" exist:
      | fullname | shortname |
      | Course 1 | C1        |
    And the following "course enrolments" exist:
      | user     | course | role    |
      | student1 | C1     | student |
      | student2 | C1     | student |
    And I entered the course "Course 1" as "student1" in the app
    When I press "Participants" in the app
    And I press "Student Student" in the app
    And I press "Details" in the app
    Then I should find "Europe/Madrid" in the app
    And I should not find "Asia/Shanghai" in the app

    When I press the back button in the app
    And I press the back button in the app
    And I press "John Smith" in the app
    And I press "Details" in the app
    Then I should find "Asia/Shanghai" in the app
    And I should not find "Europe/Madrid" in the app
