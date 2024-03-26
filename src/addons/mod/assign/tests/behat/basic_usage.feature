@mod @mod_assign @app @javascript
Feature: Test basic usage of assignment activity in app
  In order to participate in the assignment while using the mobile app
  I need basic assignment functionality to work

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
    And the following "activities" exist:
      | activity | course | idnumber | name         | intro                        | assignsubmission_onlinetext_enabled | duedate                       | attemptreopenmethod |
      | assign   | C1     | assign1  | assignment1  | Test assignment description1 | 1                                   | ## 20 August 2002 12:00 PM ## | manual              |

  @lms_from3.11
  Scenario: View assign description, due date & View list of student submissions (as teacher) & View own submission or student submission
    # Create, edit and submit as a student
    Given I entered the assign activity "assignment1" on course "Course 1" as "student1" in the app
    Then the header should be "assignment1" in the app
    And I should find "Test assignment description1" in the app
    And I should find "Due:" in the app
    And I should find "20 August 2002, 12:00 PM" in the app

    When I press "Add submission" in the app
    And I set the field "Online text submissions" to "Submission test" in the app
    And I press "Save" in the app
    Then I should find "Draft (not submitted)" in the app
    And I should find "Not graded" in the app

    When I press "Edit submission" in the app
    And I set the field "Online text submissions" to "Submission test edited" in the app
    And I press "Save" in the app
    And I press "OK" in the app
    Then I should find "Submission test edited" in the app

    When I press "Submit assignment" in the app
    And I press "OK" in the app
    Then I should find "Submitted for grading" in the app
    And I should find "Not graded" in the app
    And I should find "Submission test edited" in the app

    # View as a teacher
    Given I entered the assign activity "assignment1" on course "Course 1" as "teacher1" in the app
    Then the header should be "assignment1" in the app

    When I press "Submitted" in the app
    Then I should find "Student student" in the app
    And I should find "Not graded" in the app

    When I press "Student student" near "assignment1" in the app
    Then I should find "Online text submissions" in the app
    And I should find "Submission test edited" in the app

  Scenario: Edit/Add submission (online text) & Add new attempt from previous submission & Submit for grading
    # Submit first attempt as a student
    Given I entered the assign activity "assignment1" on course "Course 1" as "student1" in the app
    Then I should find "assignment1" in the app

    When I replace "/Assignment is overdue by: .*/" within "addon-mod-assign-submission core-tabs ion-item:nth-child(2)" with "Assignment is overdue by: [Overdue date]"
    Then the UI should match the snapshot

    When I press "Add submission" in the app
    Then I set the field "Online text submissions" to "Submission test 1st attempt" in the app
    And I press "Save" in the app
    And I press "Submit assignment" in the app
    And I press "OK" in the app

    # Allow more attempts as a teacher
    Given I entered the assign activity "assignment1" on course "Course 1" as "teacher1" in the app
    When I press "Participants" in the app
    And I press "Student student" near "assignment1" in the app
    And I press "Grade" in the app
    And I press "Allow another attempt" in the app
    And I press "Done" in the app
    Then I should find "Reopened" in the app
    And I should find "Not graded" in the app

    # Submit second attempt as a student
    Given I entered the assign activity "assignment1" on course "Course 1" as "student1" in the app
    When I pull to refresh in the app
    Then I should find "Reopened" in the app
    And I should find "2 out of Unlimited" in the app
    And I should find "Add a new attempt based on previous submission" in the app
    And I should find "Add a new attempt" in the app

    When I press "Add a new attempt based on previous submission" in the app
    And I press "OK" in the app
    Then I should find "Submission test 1st attempt" in the app

    When I set the field "Online text submissions" to "Submission test 2nd attempt" in the app
    And I press "Save" in the app
    And I press "OK" in the app
    And I press "Submit assignment" in the app
    And I press "OK" in the app

    # View second attempt as a teacher
    Given I entered the assign activity "assignment1" on course "Course 1" as "teacher1" in the app
    When I press "Participants" in the app
    And I pull to refresh in the app
    And I press "Student student" near "assignment1" in the app
    Then I should find "Online text submissions" in the app
    And I should find "Submission test 2nd attempt" in the app

  Scenario: Add submission offline (online text) & Submit for grading offline & Sync submissions
    Given I entered the assign activity "assignment1" on course "Course 1" as "student1" in the app
    When I press "Add submission" in the app
    And I switch network connection to offline
    And I set the field "Online text submissions" to "Submission test" in the app
    And I press "Save" in the app
    And I press "Submit assignment" in the app
    And I press "OK" in the app
    Then I should find "This Assignment has offline data to be synchronised." in the app

    When I switch network connection to wifi
    And I press the back button in the app
    And I press "assignment1" in the app
    And I press "Information" in the app
    And I press "Refresh" in the app
    Then I should find "Submitted for grading" in the app
    But I should not find "This Assignment has offline data to be synchronised." in the app

  Scenario: Edit an offline submission before synchronising it
    Given I entered the assign activity "assignment1" on course "Course 1" as "student1" in the app
    When I press "Add submission" in the app
    And I switch network connection to offline
    And I set the field "Online text submissions" to "Submission test original offline" in the app
    And I press "Save" in the app
    Then I should find "This Assignment has offline data to be synchronised." in the app
    And I should find "Submission test original offline" in the app

    When I press "Edit submission" in the app
    And I set the field "Online text submissions" to "Submission test edited offline" in the app
    And I press "Save" in the app
    Then I should find "This Assignment has offline data to be synchronised." in the app
    And I should find "Submission test edited offline" in the app
    But I should not find "Submission test original offline" in the app

    When I press "Submit assignment" in the app
    And I press "OK" in the app
    Then I should find "This Assignment has offline data to be synchronised." in the app

    When I switch network connection to wifi
    And I press the back button in the app
    And I press "assignment1" in the app
    Then I should find "Submitted for grading" in the app
    And I should find "Submission test edited offline" in the app
    But I should not find "This Assignment has offline data to be synchronised." in the app
