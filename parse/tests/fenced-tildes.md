# Fenced Code Blocks - Tildes

Basic triple tilde fence:
~~~js
console.log('hello')
~~~
1  2
@1 FencedOpen
@2 FencedContent

Tilde fence without info string:
~~~
plain code
~~~
1  2
@1 FencedOpen
@2 FencedContent

Mixed fence chars (backticks can't close tildes):
~~~js
console.log('test')
```
1  2
@1 FencedOpen
@2 FencedContent

Tilde fence with longer closer:
~~~js
console.log('test')
~~~~~
1  2
@1 FencedOpen
@2 FencedContent