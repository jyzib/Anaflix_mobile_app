@mod @mod_choice @app @javascript
Feature: Test basic usage of choice activity in app
  In order to participate in the choice while using the mobile app
  As a student
  I need basic choice functionality to work

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email |
      | teacher1 | Teacher | teacher | teacher1@example.com |
      | student1 | Student | student | student1@example.com |
    And the following "courses" exist:
      | fullname | shortname | category |
      | Course 1 | C1 | 0 |
    And the following "course enrolments" exist:
      | user | course | role |
      | teacher1 | C1 | editingteacher |
      | student1 | C1 | student |

  Scenario: Answer a choice (multi or single, update answer) & View results
    Given the following "activities" exist:
      | activity | name                    | intro                          | course | idnumber | option                       | allowmultiple | allowupdate | showresults |
      | choice   | Test single choice name | Test single choice description | C1     | choice1  | Option 1, Option 2, Option 3 | 0             | 0           | 1           |
    And I entered the choice activity "Test single choice name" on course "Course 1" as "student1" in the app
    When I select "Option 1" in the app
    And I select "Option 2" in the app
    And I press "Save my choice" in the app
    Then I should find "Are you sure" in the app

    When I press "OK" in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app
    But I should not find "Remove my choice" in the app

    When I press the back button in the app
    And I press "Test single choice name" in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app

  Scenario: Answer a choice (multi or single, update answer) & View results & Delete choice
    Given the following "activities" exist:
      | activity | name                    | intro                          | course | idnumber | option                       | allowmultiple | allowupdate | showresults |
      | choice   | Test multi choice name  | Test multi choice description  | C1     | choice2  | Option 1, Option 2, Option 3 | 1             | 1           | 1           |
    And I entered the choice activity "Test multi choice name" on course "Course 1" as "student1" in the app
    When I select "Option 1" in the app
    And I select "Option 2" in the app
    And I press "Save my choice" in the app
    Then I should find "Option 1: 1" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app
    And I should find "Remove my choice" in the app

    When I unselect "Option 1" in the app
    And I select "Option 3" in the app
    And I press "Save my choice" in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 1" in the app

    When I press "Remove my choice" in the app
    Then I should find "Are you sure" in the app

    When I press "Delete" in the app
    Then I should find "The results are not currently viewable" in the app
    But I should not find "Remove my choice" in the app

  Scenario: Answer and change answer offline & Sync choice
    Given the following "activities" exist:
      | activity | name                    | intro                          | course | idnumber | option                       | allowmultiple | allowupdate | showresults |
      | choice   | Test single choice name | Test single choice description | C1     | choice1  | Option 1, Option 2, Option 3 | 0             | 0           | 1           |
    And I entered the choice activity "Test single choice name" on course "Course 1" as "student1" in the app
    When I select "Option 1" in the app
    And I switch network connection to offline
    And I select "Option 2" in the app
    And I press "Save my choice" in the app
    Then I should find "Are you sure" in the app

    When I press "OK" in the app
    And I press the back button in the app
    And I press "Test single choice name" in the app
    Then I should find "This Choice has offline data to be synchronised." in the app
    But I should not find "Option 1: 0" in the app
    And I should not find "Option 2: 1" in the app
    And I should not find "Option 3: 0" in the app

    When I switch network connection to wifi
    And I press the back button in the app
    And I press "Test single choice name" in the app
    Then I should find "Test single choice description" in the app

    When I press "Information" in the app
    And I press "Refresh" in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app
    But I should not find "This Choice has offline data to be synchronised." in the app

  Scenario: Answer and change answer offline & Auto-sync choice
    Given the following "activities" exist:
      | activity | name                    | intro                          | course | idnumber | option                       | allowmultiple | allowupdate | showresults |
      | choice   | Test single choice name | Test single choice description | C1     | choice1  | Option 1, Option 2, Option 3 | 0             | 0           | 1           |
    And I entered the choice activity "Test single choice name" on course "Course 1" as "student1" in the app
    When I select "Option 1" in the app
    And I switch network connection to offline
    And I select "Option 2" in the app
    And I press "Save my choice" in the app
    Then I should find "Are you sure" in the app

    When I press "OK" in the app
    Then I should find "This Choice has offline data to be synchronised." in the app
    But I should not find "Option 1: 0" in the app
    And I should not find "Option 2: 1" in the app
    And I should not find "Option 3: 0" in the app

    When I switch network connection to wifi
    And I run cron tasks in the app
    And I wait loading to finish in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app
    But I should not find "This Choice has offline data to be synchronised." in the app

  Scenario: Prefetch
    Given the following "activities" exist:
      | activity | name                    | intro                          | course | idnumber | option                       | allowmultiple | allowupdate | showresults |
      | choice   | Test multi choice name  | Test multi choice description  | C1     | choice2  | Option 1, Option 2, Option 3 | 1             | 1           | 1           |
      | choice   | Test single choice name | Test single choice description | C1     | choice1  | Option 1, Option 2, Option 3 | 0             | 0           | 1           |
    Given I entered the course "Course 1" as "student1" in the app
    When I press "Course downloads" in the app
    When I press "Download" within "Test single choice name" "ion-item" in the app
    Then I should find "Downloaded" within "Test single choice name" "ion-item" in the app
    And I press the back button in the app

    When I switch network connection to offline
    And I press "Test multi choice name" in the app
    Then I should find "There was a problem connecting to the site. Please check your connection and try again." in the app

    When I press "OK" in the app
    And I press the back button in the app
    And I press "Test single choice name" in the app
    And I select "Option 2" in the app
    And I press "Save my choice" in the app
    Then I should find "Are you sure" in the app

    When I press "OK" in the app
    And I press the back button in the app
    And I press "Test single choice name" in the app
    Then I should find "This Choice has offline data to be synchronised." in the app
    But I should not find "Option 1: 0" in the app
    And I should not find "Option 2: 1" in the app
    And I should not find "Option 3: 0" in the app

    When I switch network connection to wifi
    And I press the back button in the app
    And I press "Test single choice name" in the app
    Then I should find "Option 1: 0" in the app
    And I should find "Option 2: 1" in the app
    And I should find "Option 3: 0" in the app
    But I should not find "This Choice has offline data to be synchronised." in the app

  # TODO remove LMS UI steps in app tests
  @lms_from4.0
  Scenario: Download students choice in text format
    # Submit answer as student
    Given the following "activities" exist:
      | activity | name        | intro                   | course | idnumber | option |
      | choice   | Choice name | Test choice description | C1     | choice1  | Option 1, Option 2, Option 3 |
    And I entered the choice activity "Choice name" on course "Course 1" as "student1" in the app
    When I select "Option 2" in the app
    And I press "Save my choice" in the app
    And I press "OK" in the app

    # Download answers as teacher
    Given I entered the choice activity "Choice name" on course "Course 1" as "teacher1" in the app
    Then I should find "Test choice description" in the app

    When I press "Information" in the app
    And I press "Open in browser" in the app
    And I switch to the browser tab opened by the app
    And I log in as "teacher1"
    And I follow "Responses"
    And I press "Download in text format"
    # TODO Then I should find "..." in the downloads folder
