@app @javascript
Feature: It has a Behat runtime with testing helpers.

  Background:
    Given the following "users" exist:
      | username |
      | student1 |

  Scenario: Finds and presses elements
    Given I entered the app as "student1"
    And I press "Search courses" in the app
    When I set the following fields to these values in the app:
      | Search | Foo bar |
    Then I should find "Search" "button" in the app
    And I should find "Clear search" in the app
    And I should be able to press "Search" "button" in the app
    But I should not be able to press "Clear search" in the app
