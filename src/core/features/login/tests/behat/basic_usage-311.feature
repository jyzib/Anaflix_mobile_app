@auth @core_auth @app @javascript @lms_upto3.11
Feature: Test basic usage of login in app
  I need basic login functionality to work

  Background:
    Given the following "users" exist:
      | username | firstname | lastname |
      | student1 | david     | student  |

  Scenario: Forgot password
    When I enter the app
    And I press "Lost password?" in the app
    And I set the field "Enter either username or email address" to "student1"
    And I press "Search" in the app
    Then I should find "Success" in the app

    When I press "OK" in the app
    And I press "Lost password?" in the app
    Then I should not find "Contact support" in the app
